#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const POINT_COUNT = 240;
const [referencePath, candidatePath] = process.argv.slice(2);

if (!referencePath || !candidatePath) {
  console.error("Usage: node tools/compare-schemes.mjs reference.txt candidate.txt");
  process.exitCode = 1;
} else {
  const [referenceText, candidateText] = await Promise.all([
    readFile(referencePath, "utf8"),
    readFile(candidatePath, "utf8"),
  ]);
  const reference = parseSequence(referenceText);
  const candidate = parseSequence(candidateText);
  const referenceStats = analyzeSequence(reference, POINT_COUNT);
  const candidateStats = analyzeSequence(candidate, POINT_COUNT);

  console.log(JSON.stringify({
    reference: referenceStats,
    candidate: candidateStats,
    delta: subtractStats(candidateStats, referenceStats),
  }, null, 2));
}

function parseSequence(text) {
  const indexedPoints = [];
  const header = text.match(/\/n\s*(\d+)\s*_+\s*(\d+)/i);
  if (header) indexedPoints.push([Number(header[2]), Number(header[1])]);

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s*_+\s*(\d+)\s*$/);
    if (match) indexedPoints.push([Number(match[2]), Number(match[1])]);
  }

  if (indexedPoints.length > 1) {
    indexedPoints.sort((a, b) => a[0] - b[0]);
    return indexedPoints.map(([, point]) => point - 1);
  }

  const arrowPoints = text.match(/\d+/g)?.map(Number) || [];
  if (arrowPoints.length > 1) return arrowPoints.map((point) => point - 1);
  throw new Error("No point sequence found in the supplied scheme");
}

function analyzeSequence(sequence, pointCount) {
  if (sequence.length < 2) throw new Error("A scheme must contain at least two points");

  const distances = [];
  const visits = new Uint32Array(pointCount);
  const directionBins = new Uint32Array(36);
  const chordUsage = new Map();
  const directions = [];
  let immediateBacktracks = 0;

  for (let index = 1; index < sequence.length; index++) {
    const from = sequence[index - 1];
    const to = sequence[index];
    if (from < 0 || from >= pointCount || to < 0 || to >= pointCount) {
      throw new Error(`Point outside 1-${pointCount} at step ${index}`);
    }

    const directDistance = Math.abs(from - to);
    distances.push(Math.min(directDistance, pointCount - directDistance));
    visits[to]++;

    const chordKey = from < to ? `${from}:${to}` : `${to}:${from}`;
    chordUsage.set(chordKey, (chordUsage.get(chordKey) || 0) + 1);
    const direction = getChordDirection(from, to, pointCount);
    directions.push(direction);
    const bin = Math.min(directionBins.length - 1, Math.floor(direction / Math.PI * directionBins.length));
    directionBins[bin]++;

    if (index < sequence.length - 1 && sequence[index - 1] === sequence[index + 1]) {
      immediateBacktracks++;
    }
  }

  let nearParallel = 0;
  let directionChangeTotal = 0;
  for (let index = 1; index < directions.length; index++) {
    const direct = Math.abs(directions[index] - directions[index - 1]);
    const difference = Math.min(direct, Math.PI - direct);
    if (difference < Math.PI / 36) nearParallel++;
    directionChangeTotal += difference;
  }

  const repeatedChords = [...chordUsage.values()]
    .reduce((total, count) => total + Math.max(0, count - 1), 0);
  distances.sort((a, b) => a - b);

  return {
    pointsInSequence: sequence.length,
    lines: sequence.length - 1,
    meanNailDistance: round(mean(distances)),
    nailDistanceP10: percentile(distances, 0.1),
    nailDistanceP50: percentile(distances, 0.5),
    nailDistanceP90: percentile(distances, 0.9),
    nailVisitCv: round(coefficientOfVariation(visits)),
    repeatedChords,
    directionCv: round(coefficientOfVariation(directionBins)),
    nearParallelRatio: round(nearParallel / Math.max(1, directions.length - 1)),
    meanDirectionChangeDegrees: round(
      directionChangeTotal / Math.max(1, directions.length - 1) * 180 / Math.PI,
    ),
    immediateBacktracks,
  };
}

function getChordDirection(from, to, pointCount) {
  const fromAngle = from / pointCount * Math.PI * 2;
  const toAngle = to / pointCount * Math.PI * 2;
  const dx = Math.cos(toAngle) - Math.cos(fromAngle);
  const dy = Math.sin(toAngle) - Math.sin(fromAngle);
  let direction = Math.atan2(dy, dx) % Math.PI;
  if (direction < 0) direction += Math.PI;
  return direction;
}

function subtractStats(candidate, reference) {
  const result = {};
  for (const [key, value] of Object.entries(candidate)) {
    if (typeof value === "number" && typeof reference[key] === "number") {
      result[key] = round(value - reference[key]);
    }
  }
  return result;
}

function percentile(sortedValues, ratio) {
  const index = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * ratio));
  return sortedValues[index];
}

function mean(values) {
  let total = 0;
  for (const value of values) total += value;
  return total / Math.max(1, values.length);
}

function coefficientOfVariation(values) {
  const average = mean(values);
  let variance = 0;
  for (const value of values) variance += (value - average) ** 2;
  variance /= Math.max(1, values.length);
  return Math.sqrt(variance) / Math.max(1e-9, average);
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}
