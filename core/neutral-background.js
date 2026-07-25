const FIXED_LEGACY_LEVEL = 145;
const MINIMUM_AUTOMATIC_LEVEL = 105;
const MAXIMUM_AUTOMATIC_LEVEL = 195;

export function neutralizeConnectedLightBackground(
  gray,
  rgba,
  mask,
  size,
  { automatic = true } = {},
) {
  const background = findConnectedLightBackground(gray, rgba, size);
  let maskedPixelCount = 0;
  let backgroundPixelCount = 0;

  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    maskedPixelCount++;
    if (background[index]) backgroundPixelCount++;
  }

  const minimumRegionSize = Math.max(32, Math.round(maskedPixelCount * 0.005));
  if (backgroundPixelCount < minimumRegionSize) {
    return {
      gray: new Float32Array(gray),
      level: null,
      backgroundPixelCount: 0,
      backgroundRatio: 0,
    };
  }

  const level = automatic
    ? chooseNeutralBackgroundLevel(gray, background, mask)
    : FIXED_LEGACY_LEVEL;
  const adjusted = new Float32Array(gray);
  for (let index = 0; index < adjusted.length; index++) {
    if (mask[index] && background[index]) {
      adjusted[index] = Math.min(adjusted[index], level);
    }
  }

  return {
    gray: adjusted,
    level,
    backgroundPixelCount,
    backgroundRatio: backgroundPixelCount / Math.max(1, maskedPixelCount),
  };
}

export function chooseNeutralBackgroundLevel(gray, background, mask) {
  const foregroundHistogram = new Uint32Array(256);
  let backgroundPixelCount = 0;
  let foregroundPixelCount = 0;

  for (let index = 0; index < gray.length; index++) {
    if (!mask[index]) continue;
    if (background[index]) {
      backgroundPixelCount++;
    } else {
      foregroundHistogram[toLuminanceBin(gray[index])]++;
      foregroundPixelCount++;
    }
  }

  if (backgroundPixelCount === 0 || foregroundPixelCount === 0) {
    return FIXED_LEGACY_LEVEL;
  }

  const totalPixelCount = backgroundPixelCount + foregroundPixelCount;
  const backgroundRatio = backgroundPixelCount / totalPixelCount;
  const foregroundAnchor = histogramQuantile(
    foregroundHistogram,
    foregroundPixelCount,
    0.7,
  );
  const targetDensityShare = clamp(
    backgroundRatio * (0.72 + (1 - backgroundRatio) * 0.16),
    0.08,
    0.56,
  );
  let bestLevel = FIXED_LEGACY_LEVEL;
  let bestError = Infinity;

  for (
    let candidate = MINIMUM_AUTOMATIC_LEVEL;
    candidate <= MAXIMUM_AUTOMATIC_LEVEL;
    candidate++
  ) {
    const normalization = getNormalizationRange(
      foregroundHistogram,
      foregroundPixelCount,
      backgroundPixelCount,
      candidate,
    );
    const foregroundDensity = getPredictedDensity(
      foregroundHistogram,
      normalization.low,
      normalization.range,
    );
    const normalizedBackground = clamp01(
      (candidate - normalization.low) / normalization.range,
    );
    const backgroundDensity = backgroundPixelCount
      * getBaseOpticalTarget(normalizedBackground);
    const predictedShare = backgroundDensity
      / Math.max(1, backgroundDensity + foregroundDensity);
    const shareError = Math.abs(predictedShare - targetDensityShare);
    const anchorError = Math.abs(candidate - foregroundAnchor) / 255;
    const error = shareError + anchorError * 0.012;

    if (
      error < bestError
      || (error === bestError && candidate > bestLevel)
    ) {
      bestError = error;
      bestLevel = candidate;
    }
  }

  return bestLevel;
}

function findConnectedLightBackground(gray, rgba, size) {
  const background = new Uint8Array(gray.length);
  const queue = new Int32Array(gray.length);
  let head = 0;
  let tail = 0;

  const isNeutralLight = (index) => {
    const offset = index * 4;
    const red = rgba[offset];
    const green = rgba[offset + 1];
    const blue = rgba[offset + 2];
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
    return gray[index] >= 205 && chroma <= 34;
  };

  const enqueue = (index) => {
    if (background[index] || !isNeutralLight(index)) return;
    background[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < size; x++) {
    enqueue(x);
    enqueue((size - 1) * size + x);
  }
  for (let y = 1; y < size - 1; y++) {
    enqueue(y * size);
    enqueue(y * size + size - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const x = index % size;
    const y = Math.floor(index / size);
    if (x > 0) enqueue(index - 1);
    if (x < size - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - size);
    if (y < size - 1) enqueue(index + size);
  }

  return background;
}

function getNormalizationRange(
  foregroundHistogram,
  foregroundPixelCount,
  backgroundPixelCount,
  backgroundLevel,
) {
  const totalPixelCount = foregroundPixelCount + backgroundPixelCount;
  const low = combinedHistogramQuantile(
    foregroundHistogram,
    backgroundPixelCount,
    backgroundLevel,
    totalPixelCount,
    0.01,
  );
  const high = combinedHistogramQuantile(
    foregroundHistogram,
    backgroundPixelCount,
    backgroundLevel,
    totalPixelCount,
    0.995,
  );
  return {
    low,
    range: Math.max(24, high - low),
  };
}

function combinedHistogramQuantile(
  histogram,
  backgroundPixelCount,
  backgroundLevel,
  totalPixelCount,
  quantile,
) {
  const target = Math.floor(totalPixelCount * quantile);
  let cumulative = 0;

  for (let level = 0; level < histogram.length; level++) {
    cumulative += histogram[level];
    if (level === backgroundLevel) cumulative += backgroundPixelCount;
    if (cumulative > target) return level;
  }
  return histogram.length - 1;
}

function getPredictedDensity(histogram, low, range) {
  let density = 0;
  for (let level = 0; level < histogram.length; level++) {
    const count = histogram[level];
    if (count === 0) continue;
    const normalized = clamp01((level - low) / range);
    density += count * getBaseOpticalTarget(normalized);
  }
  return density;
}

function getBaseOpticalTarget(normalized) {
  const opticalDensity = -Math.log(Math.max(0.04, normalized));
  return 4.1 + opticalDensity * 2.25;
}

function histogramQuantile(histogram, count, quantile) {
  const target = Math.floor(count * quantile);
  let cumulative = 0;
  for (let level = 0; level < histogram.length; level++) {
    cumulative += histogram[level];
    if (cumulative > target) return level;
  }
  return histogram.length - 1;
}

function toLuminanceBin(value) {
  return clamp(Math.round(value), 0, 255);
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
