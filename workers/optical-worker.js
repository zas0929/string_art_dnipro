import { OpticalRoutePlanner } from "../core/optical-route-planner.js";

self.addEventListener("message", (event) => {
  if (event.data?.type !== "start") return;

  try {
    generateOpticalRoute(event.data);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Неизвестная ошибка расчета",
    });
  }
});

function generateOpticalRoute({ points, settings, target, importance, plannerOptions }) {
  const lineCache = new Map();
  const planner = new OpticalRoutePlanner({
    points,
    lineCount: settings.lines,
    minSkip: settings.minSkip,
    size: settings.workSize,
    target,
    importance,
    getLineSamples: (from, to) => getLineSamples(
      from,
      to,
      points,
      settings.workSize,
      lineCache,
    ),
    ...plannerOptions,
  });
  const batch = [];
  let current = 0;

  for (let line = 0; line < settings.lines; line++) {
    const next = planner.findNext(line / settings.lines);
    if (next === -1) break;

    planner.commit(next);
    batch.push([current, next]);
    current = next;

    if (batch.length >= 40 || line === settings.lines - 1) {
      self.postMessage({
        type: "progress",
        completed: line + 1,
        total: settings.lines,
        lines: batch.splice(0),
      });
    }
  }

  if (batch.length > 0) {
    self.postMessage({
      type: "progress",
      completed: planner.sequence.length - 1,
      total: settings.lines,
      lines: batch.splice(0),
    });
  }
  self.postMessage({ type: "done", completed: planner.sequence.length - 1 });
}

function getLineSamples(from, to, points, size, cache) {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const key = `${low}:${high}`;
  if (cache.has(key)) return cache.get(key);

  const p1 = points[low];
  const p2 = points[high];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const samples = [];

  for (let step = 0; step <= steps; step++) {
    const progress = steps === 0 ? 0 : step / steps;
    const x = Math.round(p1.x + dx * progress);
    const y = Math.round(p1.y + dy * progress);
    if (x < 0 || x >= size || y < 0 || y >= size) continue;
    const index = y * size + x;
    if (samples[samples.length - 1] !== index) samples.push(index);
  }

  const packed = Int32Array.from(samples);
  cache.set(key, packed);
  return packed;
}
