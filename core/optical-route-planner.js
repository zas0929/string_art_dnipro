const DEFAULT_SCALE_FACTORS = [1, 2, 4];

export class OpticalRoutePlanner {
  constructor({
    points,
    lineCount,
    minSkip,
    size,
    target,
    importance,
    getLineSamples,
    scaleFactors = DEFAULT_SCALE_FACTORS,
    lookaheadInterval = 8,
    detailBoost = 0.1,
    targetNailDistance = 76,
    distancePenaltyStrength = 0.00004,
    distanceFeedbackStrength = 0.002,
  }) {
    this.points = points;
    this.pointCount = points.length;
    this.lineCount = lineCount;
    this.minSkip = minSkip;
    this.size = size;
    this.getFullLineSamples = getLineSamples;
    this.lookaheadInterval = lookaheadInterval;
    this.detailBoost = detailBoost;
    this.targetNailDistance = targetNailDistance;
    this.distancePenaltyStrength = distancePenaltyStrength;
    this.distanceFeedbackStrength = distanceFeedbackStrength;
    this.scales = buildResidualPyramid(target, importance, size, scaleFactors);
    this.scaledLineCache = new Map();
    this.nailUsage = new Uint16Array(this.pointCount);
    this.chordUsage = new Map();
    this.directionUsage = new Uint16Array(36);
    this.recentDirections = [];
    this.recentNailDistances = [];
    this.sequence = [0];
    this.current = 0;
    this.nailUsage[0] = 1;
  }

  findNext(progressRatio) {
    const previousPoint = this.sequence.length > 1
      ? this.sequence[this.sequence.length - 2]
      : -1;
    const recentDistanceMean = this.recentNailDistances.length
      ? average(this.recentNailDistances)
      : this.targetNailDistance;
    const shortlist = [];

    for (let candidate = 0; candidate < this.pointCount; candidate++) {
      if (!this.isCandidateAllowed(this.current, candidate, previousPoint)) continue;
      const rawScore = this.scoreImageCandidate(this.current, candidate, progressRatio, true);
      const score = this.adjustRouteScore(
        rawScore,
        this.current,
        candidate,
        recentDistanceMean,
        progressRatio,
      );
      insertCandidate(shortlist, { candidate, score }, 28);
    }

    const reranked = shortlist.map((entry) => {
      const rawScore = this.scoreImageCandidate(this.current, entry.candidate, progressRatio, false);
      return {
        candidate: entry.candidate,
        score: this.adjustRouteScore(
          rawScore,
          this.current,
          entry.candidate,
          recentDistanceMean,
          progressRatio,
        ),
      };
    }).sort((a, b) => b.score - a.score);

    if (reranked.length === 0) return -1;
    if (
      this.lookaheadInterval <= 0
      || (this.sequence.length - 1) % this.lookaheadInterval !== 0
      || reranked.length < 2
    ) {
      return reranked[0].candidate;
    }

    return this.selectWithLookahead(reranked, progressRatio, recentDistanceMean);
  }

  commit(next) {
    const from = this.current;
    this.applyLine(from, next, -1);

    const chordKey = getChordKey(from, next);
    this.chordUsage.set(chordKey, (this.chordUsage.get(chordKey) || 0) + 1);
    const direction = getChordAngle(this.points, from, next);
    this.directionUsage[getDirectionBin(direction, this.directionUsage.length)]++;
    this.recentDirections.push(direction);
    if (this.recentDirections.length > 10) this.recentDirections.shift();

    this.recentNailDistances.push(circularDistance(from, next, this.pointCount));
    if (this.recentNailDistances.length > 120) this.recentNailDistances.shift();

    this.nailUsage[next]++;
    this.sequence.push(next);
    this.current = next;
  }

  selectWithLookahead(reranked, progressRatio, recentDistanceMean) {
    const firstCandidates = reranked.slice(0, 4);
    const endpointPool = buildLookaheadPool(
      reranked,
      this.nailUsage,
      this.pointCount,
      12,
    );
    const nextProgress = Math.min(1, progressRatio + 1 / this.lineCount);
    const lookaheadWeight = 0.09 - progressRatio * 0.03;
    let bestCandidate = firstCandidates[0].candidate;
    let bestCombinedScore = -Infinity;

    for (const first of firstCandidates) {
      this.applyLine(this.current, first.candidate, -1);
      let bestSecondScore = -Infinity;

      for (const second of endpointPool) {
        if (!this.isCandidateAllowed(first.candidate, second, this.current)) continue;
        const rawSecondScore = this.scoreImageCandidate(
          first.candidate,
          second,
          nextProgress,
          true,
        );
        const secondScore = this.adjustRouteScore(
          rawSecondScore,
          first.candidate,
          second,
          recentDistanceMean,
          nextProgress,
        );
        if (secondScore > bestSecondScore) bestSecondScore = secondScore;
      }

      this.applyLine(this.current, first.candidate, 1);
      const magnitude = Math.max(1, Math.abs(first.score));
      const boundedSecondScore = Number.isFinite(bestSecondScore)
        ? clamp(bestSecondScore, -magnitude * 0.65, magnitude * 0.65)
        : 0;
      const combinedScore = first.score + boundedSecondScore * lookaheadWeight;
      if (combinedScore > bestCombinedScore) {
        bestCombinedScore = combinedScore;
        bestCandidate = first.candidate;
      }
    }

    return bestCandidate;
  }

  scoreImageCandidate(from, to, progressRatio, coarsePass) {
    const weights = this.scales.length === 1 ? [1] : getScaleWeights(progressRatio);
    let score = 0;

    const scaleCount = coarsePass ? 1 : this.scales.length;
    for (let scaleIndex = 0; scaleIndex < scaleCount; scaleIndex++) {
      const scale = this.scales[scaleIndex];
      const samples = this.getScaleLineSamples(from, to, scale);
      const stride = coarsePass ? Math.max(1, 3 - scaleIndex) : 1;
      score += weights[scaleIndex] * scoreOpticalDensityLine(
        samples,
        scale.residual,
        scale.importance,
        scale.lineStrength,
        stride,
        progressRatio,
        this.detailBoost,
      );
    }

    return score;
  }

  adjustRouteScore(score, from, candidate, recentDistanceMean, progressRatio) {
    const magnitude = Math.max(1, Math.abs(score));
    const averageVisits = (progressRatio * this.lineCount + 1) / this.pointCount;
    const balanceStrength = 0.008
      + smoothStep(0.15, 0.68, progressRatio) * 0.04
      + smoothStep(0.65, 1, progressRatio) * 0.12;
    const visitDelta = averageVisits - this.nailUsage[candidate];
    const maxVisitBias = 0.18 + progressRatio * 0.32;
    const visitBias = clamp(visitDelta * balanceStrength, -maxVisitBias, maxVisitBias);
    const newNailBias = progressRatio < 0.14 && this.nailUsage[candidate] === 0 ? 0.055 : 0;

    const repeats = this.chordUsage.get(getChordKey(from, candidate)) || 0;
    const repeatBias = Math.min(0.28, repeats * 0.085);
    const nailDistance = circularDistance(from, candidate, this.pointCount);
    const distanceDelta = nailDistance - this.targetNailDistance;
    const distancePenalty = Math.min(
      0.16,
      distanceDelta * distanceDelta * this.distancePenaltyStrength,
    );
    const distanceFeedback = clamp(
      -(recentDistanceMean - this.targetNailDistance)
        * distanceDelta
        * this.distanceFeedbackStrength,
      -0.45,
      0.45,
    );

    const direction = getChordAngle(this.points, from, candidate);
    const directionBin = getDirectionBin(direction, this.directionUsage.length);
    const averageDirectionUsage = (progressRatio * this.lineCount + 1) / this.directionUsage.length;
    const directionDelta = averageDirectionUsage - this.directionUsage[directionBin];
    const directionBalanceBias = clamp(directionDelta * 0.0005, -0.015, 0.015);
    let parallelPenalty = 0;

    for (let i = this.recentDirections.length - 1; i >= 0; i--) {
      const recency = this.recentDirections.length - i;
      const angleDelta = getAngleDistance(direction, this.recentDirections[i]);
      const closeness = Math.exp(-(angleDelta * angleDelta) / 0.012);
      parallelPenalty += closeness * (recency === 1 ? 0.025 : 0.003);
    }

    return score + magnitude * (
      visitBias
      + newNailBias
      + repeatBias
      + directionBalanceBias
      + distanceFeedback
      - distancePenalty
      - Math.min(0.055, parallelPenalty)
    );
  }

  isCandidateAllowed(from, candidate, previousPoint) {
    if (candidate === from || candidate === previousPoint) return false;
    return circularDistance(from, candidate, this.pointCount) >= this.minSkip;
  }

  applyLine(from, to, delta) {
    for (const scale of this.scales) {
      const samples = this.getScaleLineSamples(from, to, scale);
      for (let i = 0; i < samples.length; i++) {
        scale.residual[samples[i]] += delta * scale.lineStrength;
      }
    }
  }

  getScaleLineSamples(from, to, scale) {
    if (scale.factor === 1) return this.getFullLineSamples(from, to);
    const key = `${scale.factor}:${getChordKey(from, to)}`;
    if (this.scaledLineCache.has(key)) return this.scaledLineCache.get(key);

    const fullSamples = this.getFullLineSamples(from, to);
    const samples = [];
    for (let i = 0; i < fullSamples.length; i++) {
      const fullIndex = fullSamples[i];
      const x = fullIndex % this.size;
      const y = Math.floor(fullIndex / this.size);
      const scaledIndex = Math.floor(y / scale.factor) * scale.size + Math.floor(x / scale.factor);
      if (samples[samples.length - 1] !== scaledIndex) samples.push(scaledIndex);
    }

    const compactSamples = Int32Array.from(samples);
    this.scaledLineCache.set(key, compactSamples);
    return compactSamples;
  }
}

function buildResidualPyramid(target, importance, size, factors) {
  return factors.map((factor) => ({
    factor,
    size: Math.floor(size / factor),
    lineStrength: 1 / factor,
    residual: factor === 1
      ? new Float32Array(target)
      : downsampleAverage(target, size, factor),
    importance: factor === 1
      ? new Float32Array(importance)
      : downsampleImportance(importance, size, factor),
  }));
}

function downsampleAverage(values, size, factor) {
  const scaledSize = Math.floor(size / factor);
  const out = new Float32Array(scaledSize * scaledSize);
  const area = factor * factor;

  for (let y = 0; y < scaledSize; y++) {
    for (let x = 0; x < scaledSize; x++) {
      let sum = 0;
      for (let oy = 0; oy < factor; oy++) {
        const row = (y * factor + oy) * size + x * factor;
        for (let ox = 0; ox < factor; ox++) sum += values[row + ox];
      }
      out[y * scaledSize + x] = sum / area;
    }
  }

  return out;
}

function downsampleImportance(values, size, factor) {
  const scaledSize = Math.floor(size / factor);
  const out = new Float32Array(scaledSize * scaledSize);
  const area = factor * factor;

  for (let y = 0; y < scaledSize; y++) {
    for (let x = 0; x < scaledSize; x++) {
      let sum = 0;
      let maximum = 0;
      for (let oy = 0; oy < factor; oy++) {
        const row = (y * factor + oy) * size + x * factor;
        for (let ox = 0; ox < factor; ox++) {
          const value = values[row + ox];
          sum += value;
          if (value > maximum) maximum = value;
        }
      }
      out[y * scaledSize + x] = (sum / area) * 0.72 + maximum * 0.28;
    }
  }

  return out;
}

function getScaleWeights(progressRatio) {
  const coarse = 0.06 - progressRatio * 0.03;
  const middle = 0.16 - progressRatio * 0.07;
  return [1 - middle - coarse, middle, coarse];
}

function scoreOpticalDensityLine(
  samples,
  residual,
  importance,
  lineStrength,
  sampleStride,
  progressRatio,
  detailBoostStrength,
) {
  let errorReduction = 0;
  const detailProgress = smoothStep(0.48, 0.92, progressRatio);
  for (let i = 0; i < samples.length; i += sampleStride) {
    const idx = samples[i];
    const baseImportance = importance[idx];
    const detailBoost = 1
      + detailProgress * Math.max(0, baseImportance - 1) * detailBoostStrength;
    errorReduction += baseImportance * detailBoost * (
      2 * lineStrength * residual[idx] - lineStrength * lineStrength
    );
  }
  const lengthExponent = errorReduction >= 0
    ? 1.05 - progressRatio * 0.4
    : 1.05;
  return (errorReduction * sampleStride) / Math.pow(samples.length || 1, lengthExponent);
}

function buildLookaheadPool(reranked, nailUsage, pointCount, limit) {
  const pool = [];
  const seen = new Set();
  const add = (candidate) => {
    const normalized = (candidate + pointCount) % pointCount;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    pool.push(normalized);
  };

  for (const entry of reranked.slice(0, limit - 4)) add(entry.candidate);
  const leastUsed = Array.from({ length: pointCount }, (_, index) => index)
    .sort((a, b) => nailUsage[a] - nailUsage[b] || a - b);
  for (const candidate of leastUsed.slice(0, 4)) add(candidate);
  return pool.slice(0, limit);
}

function getChordAngle(points, a, b) {
  const p1 = points[a];
  const p2 = points[b];
  let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) % Math.PI;
  if (angle < 0) angle += Math.PI;
  return angle;
}

function getDirectionBin(angle, binCount) {
  return Math.min(binCount - 1, Math.floor((angle / Math.PI) * binCount));
}

function getAngleDistance(a, b) {
  const direct = Math.abs(a - b);
  return Math.min(direct, Math.PI - direct);
}

function circularDistance(a, b, count) {
  const direct = Math.abs(a - b);
  return Math.min(direct, count - direct);
}

function getChordKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function insertCandidate(shortlist, entry, limit) {
  let index = shortlist.length;
  while (index > 0 && shortlist[index - 1].score < entry.score) index--;
  shortlist.splice(index, 0, entry);
  if (shortlist.length > limit) shortlist.pop();
}

function smoothStep(edge0, edge1, value) {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function average(values) {
  let sum = 0;
  for (const value of values) sum += value;
  return values.length ? sum / values.length : 0;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
