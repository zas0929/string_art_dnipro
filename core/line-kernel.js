export function createDiscreteLineSamples(first, second, size) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const samples = [];

  for (let step = 0; step <= steps; step++) {
    const progress = steps === 0 ? 0 : step / steps;
    const x = Math.round(first.x + dx * progress);
    const y = Math.round(first.y + dy * progress);
    if (x < 0 || x >= size || y < 0 || y >= size) continue;
    const index = y * size + x;
    if (samples[samples.length - 1] !== index) samples.push(index);
  }

  return Int32Array.from(samples);
}

export function getOpticalThreadCoverage(threadMm) {
  return Math.max(0.65, threadMm * 4.6);
}

export function createSubpixelLineKernel(first, second, size, coverage = 1) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const xMajor = Math.abs(dx) >= Math.abs(dy);
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const indices = [];
  const fractions = [];
  const neighborOffset = xMajor ? size : 1;

  for (let step = 0; step <= steps; step++) {
    const progress = steps === 0 ? 0 : step / steps;
    const primary = Math.round(
      xMajor ? first.x + dx * progress : first.y + dy * progress,
    );
    const secondary = xMajor
      ? first.y + dy * progress
      : first.x + dx * progress;
    const secondaryBase = Math.floor(secondary);
    const x = xMajor ? primary : secondaryBase;
    const y = xMajor ? secondaryBase : primary;
    if (x < 0 || x >= size || y < 0 || y >= size) continue;

    indices.push(y * size + x);
    const fraction = secondary - secondaryBase;
    const neighborX = xMajor ? x : x + 1;
    const neighborY = xMajor ? y + 1 : y;
    const hasNeighbor = neighborX >= 0
      && neighborX < size
      && neighborY >= 0
      && neighborY < size;
    fractions.push(hasNeighbor ? Math.round(fraction * 255) : 0);
  }

  return {
    indices: Int32Array.from(indices),
    fractions: Uint8Array.from(fractions),
    neighborOffset,
    coverage,
    length: indices.length,
  };
}
