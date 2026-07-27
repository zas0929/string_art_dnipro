export function applyImageEnhancements(imageData, width, height, settings = {}) {
  const sharpness = clampPercent(settings.sharpness);
  const clarity = clampPercent(settings.clarity);
  if (sharpness === 0 && clarity === 0) return imageData;

  if (clarity > 0) {
    applyLocalContrast(imageData.data, width, height, clarity / 100);
  }
  if (sharpness > 0) {
    applySharpening(imageData.data, width, height, sharpness / 100);
  }
  return imageData;
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

function clampByte(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}
