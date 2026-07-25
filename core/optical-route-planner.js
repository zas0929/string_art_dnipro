const DEFAULT_SCALE_FACTORS = [1, 2, 4];
const SCALED_KERNEL_CACHE_LIMIT = 16000;
const DEFAULT_OPTIMIZATION_WINDOW_LIMIT = 120;
const DEFAULT_OPTIMIZATION_SHORTLIST_SIZE = 10;

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
    nailBalanceMultiplier = 1,
    directionBalanceStrength = 0.0005,
    directionBalanceLimit = 0.015,
    parallelPenaltyImmediate = 0.025,
    parallelPenaltyHistory = 0.003,
    parallelPenaltyLimit = 0.055,
    repeatBiasStep = 0.085,
    repeatBiasLimit = 0.28,
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
    this.nailBalanceMultiplier = nailBalanceMultiplier;
    this.directionBalanceStrength = directionBalanceStrength;
    this.directionBalanceLimit = directionBalanceLimit;
    this.parallelPenaltyImmediate = parallelPenaltyImmediate;
    this.parallelPenaltyHistory = parallelPenaltyHistory;
    this.parallelPenaltyLimit = parallelPenaltyLimit;
    this.repeatBiasStep = repeatBiasStep;
    this.repeatBiasLimit = repeatBiasLimit;
    this.scales = buildResidualPyramid(target, importance, size, scaleFactors);
    this.scaledLineCache = new Map();
    this.normalizedKernelCache = new WeakMap();
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

  optimizeWeakVertices({
    windowLimit = DEFAULT_OPTIMIZATION_WINDOW_LIMIT,
    shortlistSize = DEFAULT_OPTIMIZATION_SHORTLIST_SIZE,
    minimumGain = 0.001,
    onProgress = null,
  } = {}) {
    const availableWindows = this.sequence.length - 2;
    const cappedWindowLimit = Math.min(
      Math.max(0, Math.floor(windowLimit)),
      availableWindows,
    );
    if (cappedWindowLimit === 0) {
      return { attempted: 0, accepted: 0, totalGain: 0 };
    }

    const weakWindows = this.rankWeakWindows();
    const blocked = new Uint8Array(this.sequence.length);
    const coarseScale = this.scales[this.scales.length - 1];
    const exactScaleWeights = this.scales.length === 1 ? [1] : getScaleWeights(1);
    let attempted = 0;
    let accepted = 0;
    let totalGain = 0;

    for (const weakWindow of weakWindows) {
      if (attempted >= cappedWindowLimit) break;
      const index = weakWindow.index;
      if (blocked[index]) continue;

      const from = this.sequence[index - 1];
      const currentMiddle = this.sequence[index];
      const to = this.sequence[index + 1];
      const shortlist = [{ candidate: currentMiddle, score: 0 }];

      for (let candidate = 0; candidate < this.pointCount; candidate++) {
        if (candidate === currentMiddle || !this.isReplacementAllowed(index, candidate)) {
          continue;
        }
        const coarseGain = this.scoreVertexReplacement(
          from,
          currentMiddle,
          to,
          candidate,
          [coarseScale],
          [1],
        );
        insertCandidate(shortlist, { candidate, score: coarseGain }, shortlistSize);
      }

      let bestCandidate = currentMiddle;
      let bestGain = 0;
      for (const entry of shortlist) {
        if (entry.candidate === currentMiddle) continue;
        const fineGain = this.scoreVertexReplacement(
          from,
          currentMiddle,
          to,
          entry.candidate,
          [this.scales[0]],
          [1],
        );
        if (fineGain <= minimumGain) continue;
        const exactGain = this.scoreVertexReplacement(
          from,
          currentMiddle,
          to,
          entry.candidate,
          this.scales,
          exactScaleWeights,
        );
        if (
          exactGain > bestGain
          || (exactGain === bestGain && entry.candidate < bestCandidate)
        ) {
          bestGain = exactGain;
          bestCandidate = entry.candidate;
        }
      }

      attempted++;
      if (bestCandidate !== currentMiddle && bestGain > minimumGain) {
        this.applyLine(from, currentMiddle, 1);
        this.applyLine(currentMiddle, to, 1);
        this.applyLine(from, bestCandidate, -1);
        this.applyLine(bestCandidate, to, -1);
        this.sequence[index] = bestCandidate;
        accepted++;
        totalGain += bestGain;

        blocked[index] = 1;
        if (index > 1) blocked[index - 1] = 1;
        if (index + 1 < blocked.length - 1) blocked[index + 1] = 1;
      }

      if (
        typeof onProgress === "function"
        && (attempted % 12 === 0 || attempted === cappedWindowLimit)
      ) {
        onProgress({ attempted, accepted, total: cappedWindowLimit, totalGain });
      }
    }

    if (
      typeof onProgress === "function"
      && attempted > 0
      && attempted % 12 !== 0
    ) {
      onProgress({ attempted, accepted, total: cappedWindowLimit, totalGain });
    }

    return { attempted, accepted, totalGain };
  }

  rankWeakWindows() {
    const fineScale = this.scales[0];
    const windows = [];

    for (let index = 1; index < this.sequence.length - 1; index++) {
      windows.push({
        index,
        removalGain: this.scoreVertexReplacement(
          this.sequence[index - 1],
          this.sequence[index],
          this.sequence[index + 1],
          null,
          [fineScale],
          [1],
        ),
      });
    }

    return windows.sort(
      (a, b) => b.removalGain - a.removalGain || a.index - b.index,
    );
  }

  scoreVertexReplacement(
    from,
    currentMiddle,
    to,
    candidate,
    scales,
    scaleWeights,
  ) {
    let gain = 0;

    for (let scaleIndex = 0; scaleIndex < scales.length; scaleIndex++) {
      const scale = scales[scaleIndex];
      const residualDelta = new Map();
      accumulateKernelDelta(
        residualDelta,
        this.getScaleLineKernel(from, currentMiddle, scale),
        1,
      );
      accumulateKernelDelta(
        residualDelta,
        this.getScaleLineKernel(currentMiddle, to, scale),
        1,
      );
      if (candidate !== null) {
        accumulateKernelDelta(
          residualDelta,
          this.getScaleLineKernel(from, candidate, scale),
          -1,
        );
        accumulateKernelDelta(
          residualDelta,
          this.getScaleLineKernel(candidate, to, scale),
          -1,
        );
      }
      gain += (scaleWeights[scaleIndex] ?? 0) * scoreResidualDelta(
        residualDelta,
        scale.residual,
        scale.importance,
      );
    }

    return gain;
  }

  isReplacementAllowed(index, candidate) {
    const from = this.sequence[index - 1];
    const to = this.sequence[index + 1];
    if (
      candidate === from
      || candidate === to
      || (index > 1 && candidate === this.sequence[index - 2])
      || (index + 2 < this.sequence.length && candidate === this.sequence[index + 2])
    ) {
      return false;
    }
    return (
      circularDistance(from, candidate, this.pointCount) >= this.minSkip
      && circularDistance(candidate, to, this.pointCount) >= this.minSkip
    );
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
      const kernel = this.getScaleLineKernel(from, to, scale);
      const stride = coarsePass ? Math.max(1, 3 - scaleIndex) : 1;
      score += weights[scaleIndex] * scoreOpticalDensityLine(
        kernel,
        scale.residual,
        scale.importance,
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
    const balanceStrength = (0.008
      + smoothStep(0.15, 0.68, progressRatio) * 0.04
      + smoothStep(0.65, 1, progressRatio) * 0.12)
      * this.nailBalanceMultiplier;
    const visitDelta = averageVisits - this.nailUsage[candidate];
    const maxVisitBias = 0.18 + progressRatio * 0.32;
    const visitBias = clamp(visitDelta * balanceStrength, -maxVisitBias, maxVisitBias);
    const newNailBias = progressRatio < 0.14 && this.nailUsage[candidate] === 0 ? 0.055 : 0;

    const repeats = this.chordUsage.get(getChordKey(from, candidate)) || 0;
    const repeatBias = Math.min(this.repeatBiasLimit, repeats * this.repeatBiasStep);
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
    const directionBalanceBias = clamp(
      directionDelta * this.directionBalanceStrength,
      -this.directionBalanceLimit,
      this.directionBalanceLimit,
    );
    let parallelPenalty = 0;

    for (let i = this.recentDirections.length - 1; i >= 0; i--) {
      const recency = this.recentDirections.length - i;
      const angleDelta = getAngleDistance(direction, this.recentDirections[i]);
      const closeness = Math.exp(-(angleDelta * angleDelta) / 0.012);
      parallelPenalty += closeness * (
        recency === 1 ? this.parallelPenaltyImmediate : this.parallelPenaltyHistory
      );
    }

    return score + magnitude * (
      visitBias
      + newNailBias
      + repeatBias
      + directionBalanceBias
      + distanceFeedback
      - distancePenalty
      - Math.min(this.parallelPenaltyLimit, parallelPenalty)
    );
  }

  isCandidateAllowed(from, candidate, previousPoint) {
    if (candidate === from || candidate === previousPoint) return false;
    return circularDistance(from, candidate, this.pointCount) >= this.minSkip;
  }

  applyLine(from, to, delta) {
    for (const scale of this.scales) {
      const kernel = this.getScaleLineKernel(from, to, scale);
      if (kernel.fractions) {
        for (let i = 0; i < kernel.indices.length; i++) {
          const fraction = kernel.fractions[i] / 255;
          const baseStrength = kernel.coverage * (1 - fraction);
          scale.residual[kernel.indices[i]] += delta * baseStrength;
          if (fraction > 0) {
            scale.residual[kernel.indices[i] + kernel.neighborOffset]
              += delta * kernel.coverage * fraction;
          }
        }
      } else if (kernel.weights) {
        for (let i = 0; i < kernel.indices.length; i++) {
          scale.residual[kernel.indices[i]] += delta * kernel.weights[i];
        }
      } else {
        for (let i = 0; i < kernel.indices.length; i++) {
          scale.residual[kernel.indices[i]] += delta;
        }
      }
    }
  }

  getScaleLineKernel(from, to, scale) {
    const fullKernel = this.getFullLineKernel(from, to);
    if (scale.factor === 1) return fullKernel;
    const key = `${scale.factor}:${getChordKey(from, to)}`;
    if (this.scaledLineCache.has(key)) return this.scaledLineCache.get(key);

    const area = scale.factor * scale.factor;
    const accumulatedWeights = new Map();
    const addScaledSample = (fullIndex, weight) => {
      const x = fullIndex % this.size;
      const y = Math.floor(fullIndex / this.size);
      const scaledIndex = Math.floor(y / scale.factor) * scale.size + Math.floor(x / scale.factor);
      accumulatedWeights.set(
        scaledIndex,
        (accumulatedWeights.get(scaledIndex) || 0) + weight / area,
      );
    };

    if (fullKernel.fractions) {
      for (let i = 0; i < fullKernel.indices.length; i++) {
        const fraction = fullKernel.fractions[i] / 255;
        addScaledSample(fullKernel.indices[i], fullKernel.coverage * (1 - fraction));
        if (fraction > 0) {
          addScaledSample(
            fullKernel.indices[i] + fullKernel.neighborOffset,
            fullKernel.coverage * fraction,
          );
        }
      }
    } else if (fullKernel.weights) {
      for (let i = 0; i < fullKernel.indices.length; i++) {
        addScaledSample(fullKernel.indices[i], fullKernel.weights[i]);
      }
    } else {
      for (let i = 0; i < fullKernel.indices.length; i++) {
        addScaledSample(fullKernel.indices[i], 1);
      }
    }

    const kernel = {
      indices: Int32Array.from(accumulatedWeights.keys()),
      weights: Float32Array.from(accumulatedWeights.values()),
      length: Math.max(1, fullKernel.length / scale.factor),
    };
    if (this.scaledLineCache.size >= SCALED_KERNEL_CACHE_LIMIT) {
      this.scaledLineCache.delete(this.scaledLineCache.keys().next().value);
    }
    this.scaledLineCache.set(key, kernel);
    return kernel;
  }

  getFullLineKernel(from, to) {
    const rawKernel = this.getFullLineSamples(from, to);
    if (rawKernel.indices) return rawKernel;
    if (this.normalizedKernelCache.has(rawKernel)) {
      return this.normalizedKernelCache.get(rawKernel);
    }
    const kernel = {
      indices: rawKernel,
      weights: null,
      length: rawKernel.length,
    };
    this.normalizedKernelCache.set(rawKernel, kernel);
    return kernel;
  }
}

function buildResidualPyramid(target, importance, size, factors) {
  return factors.map((factor) => ({
    factor,
    size: Math.floor(size / factor),
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
  kernel,
  residual,
  importance,
  sampleStride,
  progressRatio,
  detailBoostStrength,
) {
  let errorReduction = 0;
  const detailProgress = smoothStep(0.48, 0.92, progressRatio);
  if (kernel.fractions) {
    for (let i = 0; i < kernel.indices.length; i += sampleStride) {
      const fraction = kernel.fractions[i] / 255;
      const baseIndex = kernel.indices[i];
      const baseStrength = kernel.coverage * (1 - fraction);
      const baseImportance = importance[baseIndex];
      const baseDetailBoost = 1
        + detailProgress * Math.max(0, baseImportance - 1) * detailBoostStrength;
      errorReduction += baseImportance * baseDetailBoost * (
        2 * baseStrength * residual[baseIndex] - baseStrength * baseStrength
      );
      if (fraction > 0) {
        const neighborIndex = baseIndex + kernel.neighborOffset;
        const neighborStrength = kernel.coverage * fraction;
        const neighborImportance = importance[neighborIndex];
        const neighborDetailBoost = 1
          + detailProgress * Math.max(0, neighborImportance - 1) * detailBoostStrength;
        errorReduction += neighborImportance * neighborDetailBoost * (
          2 * neighborStrength * residual[neighborIndex] - neighborStrength * neighborStrength
        );
      }
    }
  } else if (kernel.weights) {
    for (let i = 0; i < kernel.indices.length; i += sampleStride) {
      const idx = kernel.indices[i];
      const lineStrength = kernel.weights[i];
      const baseImportance = importance[idx];
      const detailBoost = 1
        + detailProgress * Math.max(0, baseImportance - 1) * detailBoostStrength;
      errorReduction += baseImportance * detailBoost * (
        2 * lineStrength * residual[idx] - lineStrength * lineStrength
      );
    }
  } else {
    for (let i = 0; i < kernel.indices.length; i += sampleStride) {
      const idx = kernel.indices[i];
      const baseImportance = importance[idx];
      const detailBoost = 1
        + detailProgress * Math.max(0, baseImportance - 1) * detailBoostStrength;
      errorReduction += baseImportance * detailBoost * (2 * residual[idx] - 1);
    }
  }
  const lengthExponent = errorReduction >= 0
    ? 1.05 - progressRatio * 0.4
    : 1.05;
  return (errorReduction * sampleStride) / Math.pow(kernel.length || 1, lengthExponent);
}

function accumulateKernelDelta(deltaByIndex, kernel, multiplier) {
  const add = (index, value) => {
    if (value === 0) return;
    deltaByIndex.set(index, (deltaByIndex.get(index) || 0) + value);
  };

  if (kernel.fractions) {
    for (let i = 0; i < kernel.indices.length; i++) {
      const fraction = kernel.fractions[i] / 255;
      add(kernel.indices[i], multiplier * kernel.coverage * (1 - fraction));
      if (fraction > 0) {
        add(
          kernel.indices[i] + kernel.neighborOffset,
          multiplier * kernel.coverage * fraction,
        );
      }
    }
    return;
  }

  if (kernel.weights) {
    for (let i = 0; i < kernel.indices.length; i++) {
      add(kernel.indices[i], multiplier * kernel.weights[i]);
    }
    return;
  }

  for (let i = 0; i < kernel.indices.length; i++) {
    add(kernel.indices[i], multiplier);
  }
}

function scoreResidualDelta(deltaByIndex, residual, importance) {
  let improvement = 0;

  for (const [index, delta] of deltaByIndex) {
    if (Math.abs(delta) < 1e-8) continue;
    const before = residual[index];
    const after = before + delta;
    improvement += importance[index] * (before * before - after * after);
  }

  return improvement;
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
