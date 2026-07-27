export function applyImageEnhancements(imageData, width, height, settings = {}) {
  const sharpness = clampPercent(settings.sharpness);
  const clarity = clampPercent(settings.clarity);
  const removeBackground = Boolean(settings.removeBackground);
  if (sharpness === 0 && clarity === 0 && !removeBackground) return imageData;

  if (removeBackground) {
    replaceEdgeConnectedBackground(
      imageData.data,
      width,
      height,
      clampGray(settings.backgroundGray),
    );
  }
  if (clarity > 0) {
    applyLocalContrast(imageData.data, width, height, clarity / 100);
  }
  if (sharpness > 0) {
    applySharpening(imageData.data, width, height, sharpness / 100);
  }
  return imageData;
}

function replaceEdgeConnectedBackground(data, width, height, gray) {
  if (width < 3 || height < 3) return;
  const model = estimateBorderColor(data, width, height);
  const threshold = Math.min(72, Math.max(30, 28 + model.deviation * 2.2));
  const thresholdSquared = threshold * threshold * 3;
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const addSeed = (pixel) => {
    if (mask[pixel] || !matchesBackground(data, pixel, model, thresholdSquared)) return;
    mask[pixel] = 255;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < width; x++) {
    addSeed(x);
    addSeed((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    addSeed(y * width);
    addSeed(y * width + width - 1);
  }

  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    if (x > 0) addSeed(pixel - 1);
    if (x + 1 < width) addSeed(pixel + 1);
    if (pixel >= width) addSeed(pixel - width);
    if (pixel + width < mask.length) addSeed(pixel + width);
  }

  const featherRadius = Math.max(1, Math.round(Math.min(width, height) / 280));
  const featheredMask = blurMask(mask, width, height, featherRadius);
  for (let pixel = 0; pixel < featheredMask.length; pixel++) {
    const amount = featheredMask[pixel] / 255;
    if (amount <= 0) continue;
    const offset = pixel * 4;
    data[offset] = clampByte(data[offset] + (gray - data[offset]) * amount);
    data[offset + 1] = clampByte(data[offset + 1] + (gray - data[offset + 1]) * amount);
    data[offset + 2] = clampByte(data[offset + 2] + (gray - data[offset + 2]) * amount);
  }
}

function estimateBorderColor(data, width, height) {
  const bins = new Map();
  const sample = (pixel) => {
    const offset = pixel * 4;
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    const key = (red >> 5) << 6 | (green >> 5) << 3 | (blue >> 5);
    const bin = bins.get(key) || {
      count: 0,
      red: 0,
      green: 0,
      blue: 0,
      squares: 0,
    };
    bin.count += 1;
    bin.red += red;
    bin.green += green;
    bin.blue += blue;
    bin.squares += red * red + green * green + blue * blue;
    bins.set(key, bin);
  };

  for (let x = 0; x < width; x++) {
    sample(x);
    sample((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    sample(y * width);
    sample(y * width + width - 1);
  }

  let dominant = null;
  for (const bin of bins.values()) {
    if (!dominant || bin.count > dominant.count) dominant = bin;
  }
  const count = Math.max(1, dominant?.count || 1);
  const red = (dominant?.red || 0) / count;
  const green = (dominant?.green || 0) / count;
  const blue = (dominant?.blue || 0) / count;
  const meanSquares = (dominant?.squares || 0) / count;
  const variance = Math.max(0, meanSquares - red * red - green * green - blue * blue);
  return {
    red,
    green,
    blue,
    deviation: Math.sqrt(variance / 3),
  };
}

function matchesBackground(data, pixel, model, thresholdSquared) {
  const offset = pixel * 4;
  const red = data[offset] - model.red;
  const green = data[offset + 1] - model.green;
  const blue = data[offset + 2] - model.blue;
  return red * red + green * green + blue * blue <= thresholdSquared;
}

function blurMask(mask, width, height, radius) {
  const horizontal = new Float32Array(mask.length);
  const output = new Uint8Array(mask.length);
  const diameter = radius * 2 + 1;

  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = -radius; x <= radius; x++) {
      sum += mask[y * width + Math.min(width - 1, Math.max(0, x))];
    }
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / diameter;
      const removeX = Math.max(0, x - radius);
      const addX = Math.min(width - 1, x + radius + 1);
      sum += mask[y * width + addX] - mask[y * width + removeX];
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) {
      sum += horizontal[Math.min(height - 1, Math.max(0, y)) * width + x];
    }
    for (let y = 0; y < height; y++) {
      output[y * width + x] = clampByte(sum / diameter);
      const removeY = Math.max(0, y - radius);
      const addY = Math.min(height - 1, y + radius + 1);
      sum += horizontal[addY * width + x] - horizontal[removeY * width + x];
    }
  }
  return output;
}

function applyLocalContrast(data, width, height, amount) {
  const luminance = new Float32Array(width * height);
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const value = data[offset] * 0.2126
        + data[offset + 1] * 0.7152
        + data[offset + 2] * 0.0722;
      luminance[pixel] = value;
      rowSum += value;
      integral[(y + 1) * (width + 1) + x + 1] =
        integral[y * (width + 1) + x + 1] + rowSum;
    }
  }

  const radius = 4;
  for (let y = 0; y < height; y++) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x++) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width - 1, x + radius);
      const area = (right - left + 1) * (bottom - top + 1);
      const localSum =
        integral[(bottom + 1) * (width + 1) + right + 1]
        - integral[top * (width + 1) + right + 1]
        - integral[(bottom + 1) * (width + 1) + left]
        + integral[top * (width + 1) + left];
      const pixel = y * width + x;
      const detail = luminance[pixel] - localSum / area;
      const midtoneWeight = 0.45 + 0.55 * (1 - Math.abs(luminance[pixel] - 128) / 128);
      const adjustment = detail * amount * 1.35 * midtoneWeight;
      const offset = pixel * 4;
      data[offset] = clampByte(data[offset] + adjustment);
      data[offset + 1] = clampByte(data[offset + 1] + adjustment);
      data[offset + 2] = clampByte(data[offset + 2] + adjustment);
    }
  }
}

function applySharpening(data, width, height, amount) {
  const source = new Uint8ClampedArray(data);
  const strength = amount * 0.72;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const offset = (y * width + x) * 4;
      const top = offset - width * 4;
      const bottom = offset + width * 4;
      for (let channel = 0; channel < 3; channel++) {
        const center = source[offset + channel];
        const laplacian =
          center * 4
          - source[top + channel]
          - source[bottom + channel]
          - source[offset - 4 + channel]
          - source[offset + 4 + channel];
        data[offset + channel] = clampByte(center + laplacian * strength);
      }
    }
  }
}

function clampPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, number));
}

function clampGray(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 128;
  return Math.min(255, Math.max(0, Math.round(number)));
}

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}
