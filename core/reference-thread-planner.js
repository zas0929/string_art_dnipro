export const REFERENCE_WORK_SIZE = 300;
export const REFERENCE_RECENT_PEG_WINDOW = 100;
export const REFERENCE_LINE_STRENGTH = 12;
export const REFERENCE_LINE_WIDTH = 2;

export function createReferenceTarget(rgba, size) {
  const target = new Float32Array(size * size);
  for (let index = 0; index < target.length; index++) {
    const offset = index * 4;
    const gray = (
      rgba[offset]
      + rgba[offset + 1]
      + rgba[offset + 2]
    ) / 3;
    target[index] = 127 - gray / 2;
  }
  return target;
}

export function createReferenceCirclePoints(count, size) {
  const center = size / 2;
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return {
      x: center + center * Math.cos(angle),
      y: center + center * Math.sin(angle),
    };
  });
}

export class ReferenceThreadPlanner {
  constructor({
    pointCount,
    size,
    target,
    minSkip = 15,
    recentPegWindow = REFERENCE_RECENT_PEG_WINDOW,
    lineStrength = REFERENCE_LINE_STRENGTH,
    lineWidth = REFERENCE_LINE_WIDTH,
  }) {
    this.pointCount = pointCount;
    this.size = size;
    this.minSkip = minSkip;
    this.recentPegWindow = recentPegWindow;
    this.lineStrength = lineStrength;
    this.lineWidth = lineWidth;
    this.points = createReferenceCirclePoints(pointCount, size);
    this.residual = new Float32Array(target);
    this.lineCache = new Map();
    this.lastVisit = new Int32Array(pointCount);
    this.lastVisit.fill(-1_000_000);
    this.sequence = [0];
    this.current = 0;
    this.lastVisit[0] = 0;
  }

  findNext() {
    if (this.sequence.length === 1) return this.getInitialTarget();

    const step = this.sequence.length;
    let bestCandidate = -1;
    let bestScore = -Infinity;

    for (let candidate = 0; candidate < this.pointCount; candidate++) {
      if (!this.isCandidateAllowed(candidate, step)) continue;
      const score = this.scoreLine(this.getLine(this.current, candidate));
      if (
        score > bestScore
        || (score === bestScore && (bestCandidate === -1 || candidate < bestCandidate))
      ) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }
    return bestCandidate;
  }

  commit(next) {
    if (next < 0 || next >= this.pointCount) {
      throw new Error(`Invalid reference route point: ${next}`);
    }
    this.applyLine(this.getLine(this.current, next));
    this.current = next;
    this.sequence.push(next);
    this.lastVisit[next] = this.sequence.length - 1;
  }

  getInitialTarget() {
    const referenceOffset = Math.round(this.pointCount * 49 / 240);
    return Math.max(
      this.minSkip,
      Math.min(this.pointCount - this.minSkip, referenceOffset),
    );
  }

  isCandidateAllowed(candidate, step) {
    if (candidate === this.current) return false;
    if (circularDistance(this.current, candidate, this.pointCount) < this.minSkip) {
      return false;
    }
    return step - this.lastVisit[candidate] > this.recentPegWindow;
  }

  scoreLine(line) {
    let total = 0;
    for (let index = 0; index < line.xs.length; index++) {
      total += this.sampleBilinear(line.xs[index], line.ys[index]);
    }
    return total / Math.max(1, line.xs.length);
  }

  applyLine(line) {
    const normalX = line.length ? -line.dy / line.length : 0;
    const normalY = line.length ? line.dx / line.length : 0;
    const tapCount = Math.max(1, Math.ceil(this.lineWidth * 2));
    const extent = Math.max(0, this.lineWidth / 2);

    for (let tap = 0; tap < tapCount; tap++) {
      const offset = tapCount === 1
        ? 0
        : -extent + (tap / (tapCount - 1)) * extent * 2;
      const normalizedOffset = extent ? Math.abs(offset) / extent : 0;
      const tapWeight = tapCount === 1
        ? 1
        : Math.max(0, 1 - normalizedOffset * 0.55);
      const amount = this.lineStrength * tapWeight / tapCount;

      for (let index = 0; index < line.xs.length; index++) {
        this.subtractBilinear(
          line.xs[index] + normalX * offset,
          line.ys[index] + normalY * offset,
          amount,
        );
      }
    }
  }

  getLine(a, b) {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    const key = low * this.pointCount + high;
    if (this.lineCache.has(key)) return this.lineCache.get(key);

    const first = this.points[low];
    const second = this.points[high];
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const length = Math.hypot(dx, dy);
    const sampleCount = Math.ceil(length);
    const xs = new Float32Array(sampleCount);
    const ys = new Float32Array(sampleCount);

    for (let index = 0; index < sampleCount; index++) {
      const progress = (index + 1) / (sampleCount + 1);
      xs[index] = first.x + dx * progress;
      ys[index] = first.y + dy * progress;
    }

    const line = { xs, ys, dx, dy, length };
    this.lineCache.set(key, line);
    return line;
  }

  sampleBilinear(x, y) {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const x0 = clamp(floorX, 0, this.size - 1);
    const x1 = clamp(floorX + 1, 0, this.size - 1);
    const y0 = clamp(floorY, 0, this.size - 1);
    const y1 = clamp(floorY + 1, 0, this.size - 1);
    const fractionX = x - floorX;
    const fractionY = y - floorY;
    const top = mix(
      this.residual[y0 * this.size + x0],
      this.residual[y0 * this.size + x1],
      fractionX,
    );
    const bottom = mix(
      this.residual[y1 * this.size + x0],
      this.residual[y1 * this.size + x1],
      fractionX,
    );
    return mix(top, bottom, fractionY);
  }

  subtractBilinear(x, y, amount) {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const fractionX = x - floorX;
    const fractionY = y - floorY;
    this.subtract(floorX, floorY, amount * (1 - fractionX) * (1 - fractionY));
    this.subtract(floorX + 1, floorY, amount * fractionX * (1 - fractionY));
    this.subtract(floorX, floorY + 1, amount * (1 - fractionX) * fractionY);
    this.subtract(floorX + 1, floorY + 1, amount * fractionX * fractionY);
  }

  subtract(x, y, amount) {
    if (x < 0 || x >= this.size || y < 0 || y >= this.size) return;
    const index = y * this.size + x;
    this.residual[index] = Math.max(-128, this.residual[index] - amount);
  }
}

function circularDistance(a, b, count) {
  const direct = Math.abs(a - b);
  return Math.min(direct, count - direct);
}

function mix(a, b, amount) {
  return a * (1 - amount) + b * amount;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
