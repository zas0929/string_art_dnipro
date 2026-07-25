import { ReferenceThreadPlanner } from "../core/reference-thread-planner.js";

self.addEventListener("message", (event) => {
  if (event.data?.type !== "start") return;

  try {
    generateReferenceRoute(event.data);
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Неизвестная ошибка расчета",
    });
  }
});

function generateReferenceRoute({ settings, target }) {
  const planner = new ReferenceThreadPlanner({
    pointCount: settings.points,
    size: settings.workSize,
    target,
    minSkip: settings.minSkip,
    recentPegWindow: settings.recentPegWindow,
    lineStrength: settings.lineStrength,
    lineWidth: settings.lineWidth,
  });
  const batch = [];
  let current = 0;

  for (let line = 0; line < settings.lines; line++) {
    const next = planner.findNext();
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
