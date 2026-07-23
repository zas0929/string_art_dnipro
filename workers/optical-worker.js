import { OpticalRoutePlanner } from "../core/optical-route-planner.js";
import {
  createDiscreteLineSamples,
  createSubpixelLineKernel,
} from "../core/line-kernel.js";

self.addEventListener("message", (event) => {
  try {
    if (event.data?.type === "start") {
      generateOpticalRoute(event.data);
    } else if (event.data?.type === "refine") {
      refineOpticalRoute(event.data);
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Неизвестная ошибка расчета",
    });
  }
});

function generateOpticalRoute({ points, settings, target, importance, plannerOptions }) {
  const planner = createPlanner(points, settings, target, importance, plannerOptions);
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

function refineOpticalRoute({
  points,
  settings,
  target,
  importance,
  plannerOptions,
  sequence,
}) {
  if (!sequence || sequence.length < 3 || sequence[0] !== 0) {
    throw new Error("Для улучшения нужна готовая последовательность v6");
  }
  const planner = createPlanner(points, settings, target, importance, plannerOptions);
  for (let index = 1; index < sequence.length; index++) {
    planner.commit(sequence[index]);
  }

  const optimization = planner.optimizeWeakVertices({
    windowLimit: settings.postOptimizeWindows,
    shortlistSize: settings.postOptimizeShortlist,
    onProgress: (detail) => {
      self.postMessage({ type: "refine-progress", ...detail });
    },
  });
  const refinedSequence = Int32Array.from(planner.sequence);
  self.postMessage(
    {
      type: "refined",
      sequence: refinedSequence,
      optimization,
    },
    [refinedSequence.buffer],
  );
}

function createPlanner(points, settings, target, importance, plannerOptions) {
  const lineCache = new Map();
  return new OpticalRoutePlanner({
    points,
    lineCount: settings.lines,
    minSkip: settings.minSkip,
    size: settings.workSize,
    target,
    importance,
    getLineSamples: (from, to) => getLineKernel(
      from,
      to,
      points,
      settings,
      lineCache,
    ),
    ...plannerOptions,
  });
}

function getLineKernel(from, to, points, settings, cache) {
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const key = `${low}:${high}`;
  if (cache.has(key)) return cache.get(key);

  const kernel = settings.subpixel
    ? createSubpixelLineKernel(
        points[low],
        points[high],
        settings.workSize,
        settings.lineCoverage,
      )
    : createDiscreteLineSamples(points[low], points[high], settings.workSize);
  cache.set(key, kernel);
  return kernel;
}
