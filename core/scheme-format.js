import { MAX_POINT_COUNT } from "./limits.js";

export function formatSchemeText(sequence) {
  const lines = ["Points______Lines/n1____0/"];
  for (let order = 1; order < sequence.length; order++) {
    lines.push(`${sequence[order] + 1}____  ${order}`);
  }
  return lines.join("\n");
}

export function formatCsvText(sequence) {
  const rows = ["step,from,to"];
  for (let order = 1; order < sequence.length; order++) {
    rows.push(`${order},${sequence[order - 1] + 1},${sequence[order] + 1}`);
  }
  return rows.join("\n");
}

export function parseSchemeText(text) {
  const csvSequence = parseCsvSequence(text);
  if (csvSequence) return validateSequence(csvSequence);

  const entries = [];
  const underscorePair = /(\d+)\s*_+\s*(\d+)/g;
  let match;

  while ((match = underscorePair.exec(text)) !== null) {
    entries.push({ point: Number(match[1]), order: Number(match[2]) });
  }

  if (entries.length === 0) {
    const normalized = text.replace(/\\n|\/n/gi, "\n").replaceAll("/", "\n");
    for (const line of normalized.split(/\r?\n/)) {
      const pair = line.trim().match(/^(\d+)\D+(\d+)$/);
      if (pair) entries.push({ point: Number(pair[1]), order: Number(pair[2]) });
    }
  }

  const ordered = entries.filter((entry) => entry.order >= 0).sort((a, b) => a.order - b.order);
  if (ordered.length < 3) {
    throw new Error("a 1____0 starting row and at least two following steps are required");
  }

  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].order !== i) {
      throw new Error(`expected position ${i}, received ${ordered[i].order}`);
    }
  }

  return validateSequence(ordered.map((entry) => entry.point));
}

function parseCsvSequence(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
    if (match) rows.push({ step: Number(match[1]), from: Number(match[2]), to: Number(match[3]) });
  }
  if (rows.length === 0) return null;

  rows.sort((a, b) => a.step - b.step);
  const sequence = [rows[0].from];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.step !== i + 1) throw new Error(`expected step ${i + 1}, received ${row.step}`);
    if (row.from !== sequence[sequence.length - 1]) {
      throw new Error(`sequence is broken at step ${row.step}`);
    }
    sequence.push(row.to);
  }
  return sequence;
}

function validateSequence(sequence) {
  if (sequence.length < 3) throw new Error("the pattern must contain at least two connections");
  for (const point of sequence) {
    if (!Number.isInteger(point) || point < 1 || point > MAX_POINT_COUNT) {
      throw new Error(
        `pin ${point} is outside the 1-${MAX_POINT_COUNT} range`,
      );
    }
  }
  if (sequence[0] !== 1) {
    throw new Error(`position 0 must contain starting pin 1, received ${sequence[0]}`);
  }
  return sequence;
}
