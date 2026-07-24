export function enhanceAnalysisGray(
  gray,
  mask,
  size,
  { contrast = 0, sharpness = 0 } = {},
) {
  const contrastStrength = clamp(contrast, 0, 1);
  const sharpnessStrength = clamp(sharpness, 0, 1);
  const contrasted = applyAdaptiveContrast(gray, mask, contrastStrength);
  if (sharpnessStrength === 0) return contrasted;

  const blurred = boxBlurMasked(contrasted, mask, size, 2);
  const enhanced = new Float32Array(contrasted);
  const threshold = 0.75 + sharpnessStrength * 1.25;
  const detailLimit = 14 + sharpnessStrength * 18;
  const gain = sharpnessStrength * 1.5;

  for (let index = 0; index < enhanced.length; index++) {
    if (!mask[index]) continue;
    const detail = contrasted[index] - blurred[index];
    const magnitude = Math.max(0, Math.abs(detail) - threshold);
    const limitedDetail = Math.sign(detail) * Math.min(detailLimit, magnitude);
    enhanced[index] = clamp(contrasted[index] + limitedDetail * gain, 0, 255);
  }

  return enhanced;
}

export function buildDetailPriorityMap(
  gray,
  mask,
  size,
  strength = 0,
) {
  const normalizedStrength = clamp(strength, 0, 1);
  const priority = new Float32Array(gray.length);
  if (normalizedStrength === 0) return priority;

  const fine = boxBlurMasked(gray, mask, size, 1);
  const broad = boxBlurMasked(gray, mask, size, 4);
  const gradientX = new Float32Array(gray.length);
  const gradientY = new Float32Array(gray.length);
  const tensorXX = new Float32Array(gray.length);
  const tensorYY = new Float32Array(gray.length);
  const tensorXY = new Float32Array(gray.length);

  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const index = y * size + x;
      if (!mask[index]) continue;
      const gx = (
        fine[index - size + 1]
        + fine[index + 1] * 2
        + fine[index + size + 1]
        - fine[index - size - 1]
        - fine[index - 1] * 2
        - fine[index + size - 1]
      );
      const gy = (
        fine[index + size - 1]
        + fine[index + size] * 2
        + fine[index + size + 1]
        - fine[index - size - 1]
        - fine[index - size] * 2
        - fine[index - size + 1]
      );
      gradientX[index] = gx;
      gradientY[index] = gy;
      tensorXX[index] = gx * gx;
      tensorYY[index] = gy * gy;
      tensorXY[index] = gx * gy;
    }
  }

  const meanXX = boxBlurMasked(tensorXX, mask, size, 2);
  const meanYY = boxBlurMasked(tensorYY, mask, size, 2);
  const meanXY = boxBlurMasked(tensorXY, mask, size, 2);

  for (let index = 0; index < priority.length; index++) {
    if (!mask[index]) continue;

    const tensorEnergy = meanXX[index] + meanYY[index];
    const coherence = tensorEnergy > 1
      ? Math.sqrt(
          (meanXX[index] - meanYY[index]) ** 2
          + 4 * meanXY[index] ** 2,
        ) / tensorEnergy
      : 0;
    const gradient = Math.hypot(gradientX[index], gradientY[index]);
    const edge = Math.pow(clamp(gradient / 280, 0, 1), 0.72)
      * (0.32 + coherence * 0.68);
    const darkRidge = Math.pow(
      clamp((broad[index] - fine[index] - 1.25) / 24, 0, 1),
      0.7,
    ) * (0.45 + coherence * 0.55);
    const fineDark = Math.pow(
      clamp((fine[index] - gray[index] - 1.5) / 20, 0, 1),
      0.76,
    ) * (0.3 + coherence * 0.7);
    const portraitToneWeight = 0.68 + clamp(broad[index] / 255, 0, 1) * 0.42;
    const structuralDetail = clamp(
      edge * 0.5 + darkRidge * 0.58 + fineDark * 0.18,
      0,
      1,
    );
    priority[index] = structuralDetail * portraitToneWeight * normalizedStrength;
  }

  return priority;
}

export function composeAnalysisPreviewGray(
  gray,
  detailPriority,
  mask,
  { detailDarkening = 96, outsideLevel = 18 } = {},
) {
  const preview = new Uint8ClampedArray(gray.length);
  for (let index = 0; index < preview.length; index++) {
    if (!mask[index]) {
      preview[index] = outsideLevel;
      continue;
    }
    const priority = detailPriority?.[index] || 0;
    preview[index] = clamp(
      Math.round(gray[index] - priority * detailDarkening),
      0,
      255,
    );
  }
  return preview;
}

function applyAdaptiveContrast(gray, mask, strength) {
  const output = new Float32Array(gray);
  if (strength === 0) return output;

  const histogram = new Uint32Array(256);
  let pixelCount = 0;
  for (let index = 0; index < gray.length; index++) {
    if (!mask[index]) continue;
    histogram[clamp(Math.round(gray[index]), 0, 255)]++;
    pixelCount++;
  }
  if (pixelCount === 0) return output;

  const low = histogramQuantile(histogram, pixelCount, 0.01);
  const high = histogramQuantile(histogram, pixelCount, 0.99);
  const range = Math.max(24, high - low);
  const median = histogramQuantile(histogram, pixelCount, 0.5);
  const pivot = clamp((median - low) / range, 0.22, 0.78);
  const exponent = 1 + strength * 0.9;

  for (let index = 0; index < output.length; index++) {
    if (!mask[index]) continue;
    const normalized = clamp((gray[index] - low) / range, 0, 1);
    const curved = normalized <= pivot
      ? pivot * Math.pow(normalized / Math.max(0.0001, pivot), exponent)
      : 1 - (1 - pivot) * Math.pow(
          (1 - normalized) / Math.max(0.0001, 1 - pivot),
          exponent,
        );
    output[index] = clamp(low + curved * range, 0, 255);
  }

  return output;
}

function boxBlurMasked(values, mask, size, radius) {
  const stride = size + 1;
  const valueIntegral = new Float64Array(stride * stride);
  const countIntegral = new Uint32Array(stride * stride);

  for (let y = 0; y < size; y++) {
    let rowValue = 0;
    let rowCount = 0;
    for (let x = 0; x < size; x++) {
      const sourceIndex = y * size + x;
      if (mask[sourceIndex]) {
        rowValue += values[sourceIndex];
        rowCount++;
      }
      const integralIndex = (y + 1) * stride + x + 1;
      valueIntegral[integralIndex] = valueIntegral[integralIndex - stride]
        + rowValue;
      countIntegral[integralIndex] = countIntegral[integralIndex - stride]
        + rowCount;
    }
  }

  const output = new Float32Array(values);
  for (let y = 0; y < size; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(size - 1, y + radius);
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      if (!mask[index]) continue;
      const left = Math.max(0, x - radius);
      const right = Math.min(size - 1, x + radius);
      const sum = getIntegralArea(
        valueIntegral,
        stride,
        left,
        top,
        right,
        bottom,
      );
      const count = getIntegralArea(
        countIntegral,
        stride,
        left,
        top,
        right,
        bottom,
      );
      output[index] = count > 0 ? sum / count : values[index];
    }
  }
  return output;
}

function getIntegralArea(integral, stride, left, top, right, bottom) {
  const x1 = left;
  const y1 = top;
  const x2 = right + 1;
  const y2 = bottom + 1;
  return integral[y2 * stride + x2]
    - integral[y1 * stride + x2]
    - integral[y2 * stride + x1]
    + integral[y1 * stride + x1];
}

function histogramQuantile(histogram, count, quantile) {
  const target = Math.floor(count * quantile);
  let cumulative = 0;
  for (let value = 0; value < histogram.length; value++) {
    cumulative += histogram[value];
    if (cumulative > target) return value;
  }
  return histogram.length - 1;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
