export const DEFAULT_PRINT_SETTINGS = Object.freeze({
  startStep: 1,
  endStep: 4000,
  rowsPerColumn: 51,
  columnsPerPage: 4,
});

export function createInstructionPages(sequence, settings = {}) {
  if (!Array.isArray(sequence) || sequence.length < 2) return [];

  const lineCount = sequence.length - 1;
  const startStep = clampInt(settings.startStep, 1, lineCount, 1);
  const defaultEndStep = Math.min(DEFAULT_PRINT_SETTINGS.endStep, lineCount);
  const endStep = clampInt(settings.endStep, startStep, lineCount, defaultEndStep);
  const rowsPerColumn = clampInt(settings.rowsPerColumn, 1, 70, 51);
  const columnsPerPage = clampInt(settings.columnsPerPage, 2, 5, 4);
  const rows = [];

  for (let step = startStep; step <= endStep; step++) {
    rows.push({ step, point: sequence[step] });
  }

  const columns = chunk(rows, rowsPerColumn);
  return chunk(columns, columnsPerPage);
}

function chunk(items, size) {
  const groups = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
