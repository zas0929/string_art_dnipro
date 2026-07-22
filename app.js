const resultCanvas = document.getElementById("resultCanvas");
const sourceCanvas = document.getElementById("sourceCanvas");
const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });

const imageInput = document.getElementById("imageInput");
const schemeInput = document.getElementById("schemeInput");
const pointsInput = document.getElementById("pointsInput");
const linesInput = document.getElementById("linesInput");
const sizeInput = document.getElementById("sizeInput");
const threadInput = document.getElementById("threadInput");
const opacityInput = document.getElementById("opacityInput");
const skipInput = document.getElementById("skipInput");
const algorithmInput = document.getElementById("algorithmInput");
const zoomInput = document.getElementById("zoomInput");
const resetCropButton = document.getElementById("resetCropButton");
const buildButton = document.getElementById("buildButton");
const stopButton = document.getElementById("stopButton");
const pngButton = document.getElementById("pngButton");
const txtButton = document.getElementById("txtButton");
const csvButton = document.getElementById("csvButton");
const statusText = document.getElementById("status");
const progress = document.getElementById("progress");
const pointsOut = document.getElementById("pointsOut");
const linesOut = document.getElementById("linesOut");
const stepOut = document.getElementById("stepOut");
const lengthOut = document.getElementById("lengthOut");
const sequenceOutput = document.getElementById("sequenceOutput");

const state = {
  image: null,
  prepared: null,
  points: [],
  sequence: [],
  cancelled: false,
  running: false,
  crop: {
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
  },
};

const WORK_SIZE = 560;

drawEmpty();

imageInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const image = await loadImage(file);
  state.image = image;
  state.sequence = [];
  resetCrop();
  drawPreparedPreview();
  drawInitialResult();
  setStatus("Фото загружено. Перетащите подготовленное фото для кадра или измените зум.");
  setExportEnabled(false);
});

schemeInput.addEventListener("change", async (event) => {
  const file = event.target.files && event.target.files[0];
  if (!file || state.running) return;

  try {
    const text = await file.text();
    importScheme(text);
  } catch (error) {
    setStatus(`Ошибка схемы: ${error instanceof Error ? error.message : "не удалось прочитать файл"}`);
    setExportEnabled(false);
  } finally {
    schemeInput.value = "";
  }
});

buildButton.addEventListener("click", () => {
  if (!state.image || state.running) return;
  generate();
});

stopButton.addEventListener("click", () => {
  state.cancelled = true;
  setStatus("Останавливаю после текущего блока...");
});

pngButton.addEventListener("click", () => downloadDataUrl("string-art-preview.png", resultCanvas.toDataURL("image/png")));
txtButton.addEventListener("click", () => downloadText("string-art-instruction.txt", makeInstructionText()));
csvButton.addEventListener("click", () => downloadText("string-art-steps.csv", makeCsvText()));

for (const input of [pointsInput, sizeInput, zoomInput]) {
  input.addEventListener("input", () => {
    if (!state.image || state.running) return;
    if (input === zoomInput) state.crop.zoom = clampNumber(zoomInput.value, 1, 4);
    clampCropToImage();
    invalidateResult();
    drawPreparedPreview();
  });
}

algorithmInput.addEventListener("change", () => {
  if (!state.image || state.running) return;
  invalidateResult();
  drawPreparedPreview();
});

resetCropButton.addEventListener("click", () => {
  if (!state.image || state.running) return;
  resetCrop();
  invalidateResult();
  drawPreparedPreview();
});

sourceCanvas.addEventListener("pointerdown", (event) => {
  if (!state.image || state.running) return;
  sourceCanvas.setPointerCapture(event.pointerId);
  state.crop.dragging = true;
  state.crop.lastX = event.clientX;
  state.crop.lastY = event.clientY;
});

sourceCanvas.addEventListener("pointermove", (event) => {
  if (!state.crop.dragging || !state.image || state.running) return;
  const rect = sourceCanvas.getBoundingClientRect();
  const scale = WORK_SIZE / rect.width;
  state.crop.offsetX += (event.clientX - state.crop.lastX) * scale;
  state.crop.offsetY += (event.clientY - state.crop.lastY) * scale;
  clampCropToImage();
  state.crop.lastX = event.clientX;
  state.crop.lastY = event.clientY;
  drawPreparedPreview();
});

sourceCanvas.addEventListener("pointerup", stopDragging);
sourceCanvas.addEventListener("pointercancel", stopDragging);

sourceCanvas.addEventListener("wheel", (event) => {
  if (!state.image || state.running) return;
  event.preventDefault();
  const rect = sourceCanvas.getBoundingClientRect();
  const before = canvasPointToWorkPoint(event, rect);
  const previousZoom = state.crop.zoom;
  const nextZoom = clampNumber(previousZoom * (event.deltaY < 0 ? 1.08 : 0.92), 1, 4);
  if (nextZoom === previousZoom) return;
  state.crop.zoom = nextZoom;
  zoomInput.value = nextZoom.toFixed(2);
  state.crop.offsetX = before.x - WORK_SIZE / 2 - ((before.x - WORK_SIZE / 2 - state.crop.offsetX) * nextZoom) / previousZoom;
  state.crop.offsetY = before.y - WORK_SIZE / 2 - ((before.y - WORK_SIZE / 2 - state.crop.offsetY) * nextZoom) / previousZoom;
  clampCropToImage();
  invalidateResult();
  drawPreparedPreview();
}, { passive: false });

async function generate() {
  state.cancelled = false;
  state.running = true;
  buildButton.disabled = true;
  stopButton.disabled = false;
  setExportEnabled(false);
  progress.value = 0;

  const settings = readSettings();
  const prepared = prepareImage(settings);
  state.prepared = prepared;
  state.points = buildCirclePoints(settings.points, WORK_SIZE / 2 - 8, WORK_SIZE / 2, WORK_SIZE / 2);
  state.sequence = [0];

  const residual = new Float32Array(prepared.target);
  const drawn = new Float32Array(prepared.target.length);
  const lineCache = new Map();
  let current = 0;
  let renderedLines = [];
  let renderedLineCount = 0;

  drawSourceFromPrepared(prepared, settings);
  drawResultBase(settings);

  for (let line = 0; line < settings.lines; line++) {
    if (state.cancelled) break;

    const progressRatio = line / settings.lines;
    const scoringProfile = getScoringProfile(settings.algorithm, progressRatio);
    const next = findBestNextPoint(
      current,
      residual,
      drawn,
      prepared,
      scoringProfile,
      settings,
      lineCache,
    );
    if (next === -1) break;

    const samples = getLineSamples(current, next, settings, lineCache);
    for (let i = 0; i < samples.length; i++) {
      residual[samples[i]] = Math.max(0, residual[samples[i]] - settings.lineStrength);
      drawn[samples[i]] += settings.lineStrength;
    }

    renderedLines.push([current, next]);
    state.sequence.push(next);
    current = next;

    if (line % 20 === 0 || line === settings.lines - 1) {
      drawThreadLines(renderedLines, settings, renderedLineCount);
      renderedLineCount = renderedLines.length;
      updateSummary(settings, line + 1);
      progress.value = (line + 1) / settings.lines;
      const stage = scoringProfile.stage ? ` (${scoringProfile.stage})` : "";
      setStatus(`Построено линий: ${line + 1} / ${settings.lines}${stage}`);
      await waitFrame();
    }
  }

  drawResultBase(settings);
  drawThreadLines(renderedLines, settings);
  updateSummary(settings, renderedLines.length);
  sequenceOutput.value = formatSequence(state.sequence);
  progress.value = 1;
  setStatus(state.cancelled ? "Построение остановлено. Инструкция сохранена частично." : "Готово. Инструкция построена.");
  setExportEnabled(state.sequence.length > 1);
  buildButton.disabled = false;
  stopButton.disabled = true;
  state.running = false;
}

function readSettings() {
  const algorithm = ["classic", "portrait", "portrait-v2"].includes(algorithmInput.value)
    ? algorithmInput.value
    : "portrait-v2";
  return {
    points: clampInt(pointsInput.value, 60, 600),
    lines: clampInt(linesInput.value, 100, 8000),
    sizeCm: clampNumber(sizeInput.value, 10, 200),
    threadMm: clampNumber(threadInput.value, 0.05, 1),
    zoom: state.crop.zoom,
    offsetX: state.crop.offsetX,
    offsetY: state.crop.offsetY,
    lineStrength: clampNumber(opacityInput.value, 4, 36) / 255,
    minSkip: clampInt(skipInput.value, 2, 80),
    algorithm,
  };
}

function prepareImage(settings) {
  const temp = document.createElement("canvas");
  temp.width = WORK_SIZE;
  temp.height = WORK_SIZE;
  const ctx = temp.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, WORK_SIZE, WORK_SIZE);

  const fit = getImageFit(state.image, WORK_SIZE, settings);
  ctx.drawImage(state.image, fit.x, fit.y, fit.width, fit.height);

  const imageData = ctx.getImageData(0, 0, WORK_SIZE, WORK_SIZE);
  const data = imageData.data;
  const gray = new Float32Array(WORK_SIZE * WORK_SIZE);
  const mask = new Uint8Array(WORK_SIZE * WORK_SIZE);
  const target = new Float32Array(WORK_SIZE * WORK_SIZE);
  const radius = WORK_SIZE / 2 - 8;
  const cx = WORK_SIZE / 2;
  const cy = WORK_SIZE / 2;

  for (let y = 0; y < WORK_SIZE; y++) {
    for (let x = 0; x < WORK_SIZE; x++) {
      const idx = y * WORK_SIZE + x;
      const offset = idx * 4;
      const dx = x - cx;
      const dy = y - cy;
      const inside = dx * dx + dy * dy <= radius * radius;
      mask[idx] = inside ? 1 : 0;
      gray[idx] = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
    }
  }

  const threadTarget = buildThreadTarget(gray, mask, WORK_SIZE, settings.algorithm);
  for (let y = 0; y < WORK_SIZE; y++) {
    for (let x = 0; x < WORK_SIZE; x++) {
      const idx = y * WORK_SIZE + x;
      const offset = idx * 4;
      const inside = mask[idx] === 1;
      target[idx] = inside ? threadTarget.target[idx] : 0;
      if (!inside) {
        data[offset] = 18;
        data[offset + 1] = 18;
        data[offset + 2] = 18;
        data[offset + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return {
    canvas: temp,
    target,
    detailWeight: threadTarget.detailWeight,
    tangentX: threadTarget.tangentX,
    tangentY: threadTarget.tangentY,
    orientationConfidence: threadTarget.orientationConfidence,
  };
}

function buildThreadTarget(gray, mask, size, algorithm) {
  const normalized = normalizeByPercentiles(gray, mask);
  const smooth = boxBlurValues(normalized, mask, size, 3);
  const local = new Float32Array(gray.length);
  const edges = sobelMagnitude(normalized, mask, size);
  const target = new Float32Array(gray.length);
  const detailWeight = algorithm === "classic" ? null : new Float32Array(gray.length);
  const broad = detailWeight ? boxBlurFast(normalized, mask, size, 10) : null;

  for (let i = 0; i < gray.length; i++) {
    if (!mask[i]) continue;
    const highPass = normalized[i] - smooth[i];
    local[i] = clamp01(normalized[i] + highPass * 0.75);
  }

  for (let i = 0; i < gray.length; i++) {
    if (!mask[i]) continue;
    let darkness = 1 - local[i];
    darkness = Math.pow(clamp01(darkness), 0.82);
    const detail = Math.pow(edges[i], 0.7) * 0.22;
    let portraitDetail = 0;

    if (detailWeight) {
      const localDark = Math.max(0, broad[i] - normalized[i]);
      const brightNeighborhood = 0.55 + broad[i] * 0.75;
      portraitDetail = Math.pow(clamp01(localDark * 3.2), 0.68) * brightNeighborhood;
      detailWeight[i] = clamp01(portraitDetail * 0.82 + Math.pow(edges[i], 0.72) * 0.28);
    }

    target[i] = clamp01(darkness * 0.92 + detail + portraitDetail * 0.12);
  }

  const tangents = algorithm === "portrait-v2" ? buildContourTangents(normalized, mask, size) : null;
  return {
    target,
    detailWeight,
    tangentX: tangents ? tangents.x : null,
    tangentY: tangents ? tangents.y : null,
    orientationConfidence: tangents ? edges : null,
  };
}

function normalizeByPercentiles(gray, mask) {
  const values = [];
  for (let i = 0; i < gray.length; i++) {
    if (mask[i]) values.push(gray[i]);
  }
  values.sort((a, b) => a - b);
  const low = values[Math.floor(values.length * 0.01)] ?? 0;
  const high = values[Math.floor(values.length * 0.995)] ?? 255;
  const range = Math.max(24, high - low);
  const out = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    out[i] = mask[i] ? clamp01((gray[i] - low) / range) : 1;
  }
  return out;
}

function boxBlurValues(values, mask, size, radius) {
  const out = new Float32Array(values.length);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!mask[idx]) {
        out[idx] = 1;
        continue;
      }
      let sum = 0;
      let count = 0;
      for (let yy = Math.max(0, y - radius); yy <= Math.min(size - 1, y + radius); yy++) {
        for (let xx = Math.max(0, x - radius); xx <= Math.min(size - 1, x + radius); xx++) {
          const sample = yy * size + xx;
          if (!mask[sample]) continue;
          sum += values[sample];
          count++;
        }
      }
      out[idx] = count ? sum / count : values[idx];
    }
  }
  return out;
}

function boxBlurFast(values, mask, size, radius) {
  const out = new Float32Array(values.length);
  const stride = size + 1;
  const sums = new Float64Array(stride * stride);
  const counts = new Uint32Array(stride * stride);

  for (let y = 1; y <= size; y++) {
    let rowSum = 0;
    let rowCount = 0;
    for (let x = 1; x <= size; x++) {
      const source = (y - 1) * size + x - 1;
      if (mask[source]) {
        rowSum += values[source];
        rowCount++;
      }
      const integral = y * stride + x;
      sums[integral] = sums[integral - stride] + rowSum;
      counts[integral] = counts[integral - stride] + rowCount;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      if (!mask[idx]) {
        out[idx] = 1;
        continue;
      }
      const left = Math.max(0, x - radius);
      const top = Math.max(0, y - radius);
      const right = Math.min(size - 1, x + radius) + 1;
      const bottom = Math.min(size - 1, y + radius) + 1;
      const bottomRight = bottom * stride + right;
      const bottomLeft = bottom * stride + left;
      const topRight = top * stride + right;
      const topLeft = top * stride + left;
      const sum = sums[bottomRight] - sums[bottomLeft] - sums[topRight] + sums[topLeft];
      const count = counts[bottomRight] - counts[bottomLeft] - counts[topRight] + counts[topLeft];
      out[idx] = count ? sum / count : values[idx];
    }
  }

  return out;
}

function sobelMagnitude(values, mask, size) {
  const out = new Float32Array(values.length);
  let max = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const idx = y * size + x;
      if (!mask[idx]) continue;
      const tl = values[(y - 1) * size + x - 1];
      const tc = values[(y - 1) * size + x];
      const tr = values[(y - 1) * size + x + 1];
      const ml = values[y * size + x - 1];
      const mr = values[y * size + x + 1];
      const bl = values[(y + 1) * size + x - 1];
      const bc = values[(y + 1) * size + x];
      const br = values[(y + 1) * size + x + 1];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const edge = Math.sqrt(gx * gx + gy * gy);
      out[idx] = edge;
      if (edge > max) max = edge;
    }
  }
  if (max > 0) {
    for (let i = 0; i < out.length; i++) out[i] = clamp01(out[i] / max);
  }
  return out;
}

function buildContourTangents(values, mask, size) {
  const x = new Float32Array(values.length);
  const y = new Float32Array(values.length);

  for (let py = 1; py < size - 1; py++) {
    for (let px = 1; px < size - 1; px++) {
      const idx = py * size + px;
      if (!mask[idx]) continue;
      const tl = values[(py - 1) * size + px - 1];
      const tc = values[(py - 1) * size + px];
      const tr = values[(py - 1) * size + px + 1];
      const ml = values[py * size + px - 1];
      const mr = values[py * size + px + 1];
      const bl = values[(py + 1) * size + px - 1];
      const bc = values[(py + 1) * size + px];
      const br = values[(py + 1) * size + px + 1];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      if (magnitude <= 0.0001) continue;
      x[idx] = -gy / magnitude;
      y[idx] = gx / magnitude;
    }
  }

  return { x, y };
}

function getScoringProfile(algorithm, progressRatio) {
  if (algorithm === "classic") {
    return { detailScale: 0, detailBase: 0, orientationScale: 0, overdrawPenalty: 0.018, stage: null };
  }
  if (algorithm === "portrait") {
    return {
      detailScale: 0.18 + smoothStep(0.28, 0.9, progressRatio) * 1.05,
      detailBase: 1,
      orientationScale: 0,
      overdrawPenalty: 0.018,
      stage: null,
    };
  }
  if (progressRatio < 0.56) {
    return { detailScale: 0.2, detailBase: 1, orientationScale: 0.06, overdrawPenalty: 0.018, stage: "тон" };
  }
  if (progressRatio < 0.82) {
    return { detailScale: 0.65, detailBase: 1, orientationScale: 0.2, overdrawPenalty: 0.018, stage: "контуры" };
  }
  return { detailScale: 1.15, detailBase: 1, orientationScale: 0.34, overdrawPenalty: 0.018, stage: "детали" };
}

function findBestNextPoint(current, residual, drawn, prepared, scoringProfile, settings, lineCache) {
  if (!prepared.detailWeight) {
    let best = -1;
    let bestScore = -Infinity;
    for (let candidate = 0; candidate < settings.points; candidate++) {
      if (candidate === current) continue;
      const distance = circularDistance(current, candidate, settings.points);
      if (distance < settings.minSkip) continue;

      const samples = getLineSamples(current, candidate, settings, lineCache);
      const score = scoreLineSamples(samples, residual, drawn, prepared, scoringProfile, settings, 1, 0, 0);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  }

  const shortlist = [];
  for (let candidate = 0; candidate < settings.points; candidate++) {
    if (candidate === current) continue;
    const distance = circularDistance(current, candidate, settings.points);
    if (distance < settings.minSkip) continue;

    const samples = getLineSamples(current, candidate, settings, lineCache);
    const direction = getLineDirection(current, candidate);
    const score = scoreLineSamples(
      samples,
      residual,
      drawn,
      prepared,
      scoringProfile,
      settings,
      3,
      direction.x,
      direction.y,
    );
    insertCandidate(shortlist, { candidate, samples, score, direction }, 24);
  }

  let best = -1;
  let bestScore = -Infinity;
  for (const entry of shortlist) {
    const score = scoreLineSamples(
      entry.samples,
      residual,
      drawn,
      prepared,
      scoringProfile,
      settings,
      1,
      entry.direction.x,
      entry.direction.y,
    );
    if (score > bestScore) {
      bestScore = score;
      best = entry.candidate;
    }
  }

  return best;
}

function scoreLineSamples(samples, residual, drawn, prepared, scoringProfile, settings, sampleStride, lineX, lineY) {
  let score = 0;
  let overdraw = 0;

  for (let i = 0; i < samples.length; i += sampleStride) {
    const idx = samples[i];
    const error = residual[idx];
    let weight = 1;
    if (prepared.detailWeight) {
      let directionalWeight = scoringProfile.detailBase;
      if (prepared.tangentX && scoringProfile.orientationScale > 0) {
        const alignment = lineX * prepared.tangentX[idx] + lineY * prepared.tangentY[idx];
        const confidence = prepared.orientationConfidence[idx];
        const centeredAlignment = 2 * alignment * alignment - 1;
        const rawOrientationFactor = 1 + scoringProfile.orientationScale * confidence * centeredAlignment;
        const orientationFactor = Math.max(0.35, Math.min(1.65, rawOrientationFactor));
        directionalWeight *= orientationFactor;
      }
      weight += prepared.detailWeight[idx] * scoringProfile.detailScale * directionalWeight;
    }
    score += error * error * weight;
    if (drawn[idx] > residual[idx] + settings.lineStrength) {
      overdraw += drawn[idx] - residual[idx];
    }
  }

  return (score * sampleStride) / Math.sqrt(samples.length || 1)
    - overdraw * sampleStride * scoringProfile.overdrawPenalty;
}

function getLineDirection(a, b) {
  const p1 = state.points[a];
  const p2 = state.points[b];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / length, y: dy / length };
}

function insertCandidate(shortlist, entry, limit) {
  let index = shortlist.length;
  while (index > 0 && shortlist[index - 1].score < entry.score) index--;
  shortlist.splice(index, 0, entry);
  if (shortlist.length > limit) shortlist.pop();
}

function getLineSamples(a, b, settings, cache) {
  const low = Math.min(a, b);
  const high = Math.max(a, b);
  const key = `${low}:${high}`;
  if (cache.has(key)) return cache.get(key);

  const p1 = state.points[low];
  const p2 = state.points[high];
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const samples = [];

  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(p1.x + dx * t);
    const y = Math.round(p1.y + dy * t);
    if (x >= 0 && x < WORK_SIZE && y >= 0 && y < WORK_SIZE) {
      const idx = y * WORK_SIZE + x;
      if (samples[samples.length - 1] !== idx) samples.push(idx);
    }
  }

  const packed = Int32Array.from(samples);
  cache.set(key, packed);
  return packed;
}

function buildCirclePoints(count, radius, cx, cy) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
    });
  }
  return points;
}

function importScheme(text) {
  const sequence = parseScheme(text);
  const maxPoint = Math.max(...sequence);
  const pointCount = Math.max(clampInt(pointsInput.value, 60, 600), maxPoint);
  const lineCount = sequence.length - 1;
  const settings = {
    ...readSettings(),
    points: pointCount,
    lines: lineCount,
  };

  pointsInput.value = String(pointCount);
  linesInput.value = String(lineCount);
  imageInput.value = "";
  state.image = null;
  state.prepared = null;
  state.cancelled = false;
  state.sequence = sequence.map((point) => point - 1);
  state.points = buildCirclePoints(pointCount, WORK_SIZE / 2 - 8, WORK_SIZE / 2, WORK_SIZE / 2);

  const renderedLines = [];
  for (let i = 1; i < state.sequence.length; i++) {
    renderedLines.push([state.sequence[i - 1], state.sequence[i]]);
  }

  drawResultBase(settings);
  drawThreadLines(renderedLines, settings);
  drawSchemePlaceholder(pointCount, lineCount);
  updateSummary(settings, lineCount);
  sequenceOutput.value = formatSequence(state.sequence);
  progress.value = 1;
  setStatus(`Схема загружена: ${sequence.length} точек в последовательности, ${lineCount} соединений.`);
  setExportEnabled(true);
}

function parseScheme(text) {
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

  const ordered = entries.filter((entry) => entry.order >= 1).sort((a, b) => a.order - b.order);
  if (ordered.length < 2) {
    throw new Error("нужно минимум две строки вида 50____1 и 25____2");
  }

  for (let i = 0; i < ordered.length; i++) {
    const entry = ordered[i];
    const expectedOrder = i + 1;
    if (!Number.isInteger(entry.point) || entry.point < 1 || entry.point > 600) {
      throw new Error(`точка ${entry.point} вне диапазона 1–600`);
    }
    if (entry.order !== expectedOrder) {
      throw new Error(`после позиции ${i} ожидается позиция ${expectedOrder}, получено ${entry.order}`);
    }
  }

  return ordered.map((entry) => entry.point);
}

function drawSchemePlaceholder(pointCount, lineCount) {
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.fillStyle = "#101114";
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.fillStyle = "#a9b0ba";
  sourceCtx.textAlign = "center";
  sourceCtx.textBaseline = "middle";
  sourceCtx.font = "20px system-ui";
  sourceCtx.fillText("Схема загружена", sourceCanvas.width / 2, sourceCanvas.height / 2 - 16);
  sourceCtx.font = "14px system-ui";
  sourceCtx.fillText(`${pointCount} точек · ${lineCount} соединений`, sourceCanvas.width / 2, sourceCanvas.height / 2 + 18);
}

function drawPreparedPreview() {
  const settings = readSettings();
  const prepared = prepareImage(settings);
  drawSourceFromPrepared(prepared, settings);
}

function resetCrop() {
  state.crop.zoom = 1;
  state.crop.offsetX = 0;
  state.crop.offsetY = 0;
  state.crop.dragging = false;
  zoomInput.value = "1";
}

function stopDragging() {
  if (!state.crop.dragging) return;
  state.crop.dragging = false;
  invalidateResult();
}

function canvasPointToWorkPoint(event, rect) {
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORK_SIZE,
    y: ((event.clientY - rect.top) / rect.height) * WORK_SIZE,
  };
}

function getImageFit(image, size, settings) {
  const baseScale = Math.max(size / image.width, size / image.height);
  const scale = baseScale * settings.zoom;
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: size / 2 - width / 2 + settings.offsetX,
    y: size / 2 - height / 2 + settings.offsetY,
    width,
    height,
  };
}

function clampCropToImage() {
  if (!state.image) return;
  const baseScale = Math.max(WORK_SIZE / state.image.width, WORK_SIZE / state.image.height);
  const width = state.image.width * baseScale * state.crop.zoom;
  const height = state.image.height * baseScale * state.crop.zoom;
  const maxX = Math.max(0, (width - WORK_SIZE) / 2);
  const maxY = Math.max(0, (height - WORK_SIZE) / 2);
  state.crop.offsetX = Math.max(-maxX, Math.min(maxX, state.crop.offsetX));
  state.crop.offsetY = Math.max(-maxY, Math.min(maxY, state.crop.offsetY));
}

function invalidateResult() {
  state.sequence = [];
  setExportEnabled(false);
  sequenceOutput.value = "";
  pointsOut.textContent = "-";
  linesOut.textContent = "-";
  stepOut.textContent = "-";
  lengthOut.textContent = "-";
  progress.value = 0;
  setStatus("Кадр изменён. Нажмите «Построить», чтобы пересчитать инструкцию.");
  if (state.image) drawInitialResult();
}

function drawSourceFromPrepared(prepared, settings) {
  sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.fillStyle = "#050506";
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  sourceCtx.drawImage(prepared.canvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
  drawNails(sourceCtx, buildCirclePoints(settings.points, sourceCanvas.width / 2 - 16, sourceCanvas.width / 2, sourceCanvas.height / 2), sourceCanvas.width);
}

function drawInitialResult() {
  const settings = readSettings();
  state.points = buildCirclePoints(settings.points, WORK_SIZE / 2 - 8, WORK_SIZE / 2, WORK_SIZE / 2);
  drawResultBase(settings);
}

function drawResultBase(settings) {
  resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.fillStyle = "#f6f3ea";
  resultCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.save();
  resultCtx.beginPath();
  resultCtx.arc(resultCanvas.width / 2, resultCanvas.height / 2, resultCanvas.width / 2 - 20, 0, Math.PI * 2);
  resultCtx.clip();
  resultCtx.fillStyle = "#f8f6ef";
  resultCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.restore();
  resultCtx.strokeStyle = "#2d2f34";
  resultCtx.lineWidth = 2;
  resultCtx.beginPath();
  resultCtx.arc(resultCanvas.width / 2, resultCanvas.height / 2, resultCanvas.width / 2 - 20, 0, Math.PI * 2);
  resultCtx.stroke();
  const displayPoints = buildCirclePoints(settings.points, resultCanvas.width / 2 - 20, resultCanvas.width / 2, resultCanvas.height / 2);
  drawNails(resultCtx, displayPoints, resultCanvas.width);
}

function drawThreadLines(lines, settings, startIndex = 0) {
  const scale = resultCanvas.width / WORK_SIZE;
  resultCtx.save();
  resultCtx.beginPath();
  resultCtx.arc(resultCanvas.width / 2, resultCanvas.height / 2, resultCanvas.width / 2 - 20, 0, Math.PI * 2);
  resultCtx.clip();
  resultCtx.globalAlpha = 0.075 + settings.threadMm * 0.32;
  resultCtx.strokeStyle = "#050506";
  resultCtx.lineWidth = Math.max(0.42, settings.threadMm * 3.6);
  for (let i = startIndex; i < lines.length; i++) {
    const [a, b] = lines[i];
    const p1 = state.points[a];
    const p2 = state.points[b];
    resultCtx.beginPath();
    resultCtx.moveTo(p1.x * scale, p1.y * scale);
    resultCtx.lineTo(p2.x * scale, p2.y * scale);
    resultCtx.stroke();
  }
  resultCtx.restore();
}

function drawNails(ctx, points, canvasSize) {
  ctx.save();
  ctx.fillStyle = "#2e333b";
  ctx.strokeStyle = "#f3f5f7";
  ctx.lineWidth = 1;
  const dot = canvasSize > 500 ? 2.1 : 1.2;
  const labelEvery = Math.max(1, Math.ceil(points.length / 30));
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, dot, 0, Math.PI * 2);
    ctx.fill();
    const pointNumber = index + 1;
    if (pointNumber === 1 || pointNumber === points.length || pointNumber % labelEvery === 0) {
      const labelX = point.x + (point.x - canvasSize / 2) * 0.035;
      let labelY = point.y + (point.y - canvasSize / 2) * 0.035;
      if (pointNumber === 1) labelY += 8;
      if (pointNumber === points.length) labelY -= 8;
      ctx.fillStyle = "#5c6470";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(pointNumber), labelX, labelY);
      ctx.fillStyle = "#2e333b";
    }
  });
  ctx.restore();
}

function drawEmpty() {
  resultCtx.fillStyle = "#f6f3ea";
  resultCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  resultCtx.fillStyle = "#101114";
  sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
  resultCtx.fillStyle = "#5b616b";
  sourceCtx.fillStyle = "#5b616b";
  resultCtx.textAlign = "center";
  sourceCtx.textAlign = "center";
  resultCtx.font = "20px system-ui";
  sourceCtx.font = "20px system-ui";
  resultCtx.fillText("Итоговая нить", resultCanvas.width / 2, resultCanvas.height / 2);
  sourceCtx.fillText("Подготовленное фото", sourceCanvas.width / 2, sourceCanvas.height / 2);
}

function updateSummary(settings, lineCount) {
  pointsOut.textContent = String(settings.points);
  linesOut.textContent = String(lineCount);
  stepOut.textContent = state.sequence.length > 1
    ? `${state.sequence[state.sequence.length - 2] + 1} -> ${state.sequence[state.sequence.length - 1] + 1}`
    : "-";
  lengthOut.textContent = estimateThreadLength(settings, lineCount);
}

function estimateThreadLength(settings, lineCount) {
  if (state.sequence.length < 2) return "-";
  const radiusCm = settings.sizeCm / 2;
  let total = 0;
  for (let i = 1; i < state.sequence.length; i++) {
    const a = state.sequence[i - 1];
    const b = state.sequence[i];
    const angle = (circularDistance(a, b, settings.points) / settings.points) * Math.PI * 2;
    total += 2 * radiusCm * Math.sin(angle / 2);
  }
  return `${(total / 100).toFixed(2)} м`;
}

function makeInstructionText() {
  const settings = readSettings();
  const lines = [
    "String Art Generator",
    `Points: ${settings.points}`,
    `Lines: ${state.sequence.length - 1}`,
    `Size: ${settings.sizeCm} cm`,
    `Thread: ${settings.threadMm} mm`,
    "Point 1 is at the right (3 o'clock). Numbering goes clockwise.",
    "",
    "Sequence:",
    formatSequence(state.sequence),
    "",
    "Steps:",
  ];

  for (let i = 1; i < state.sequence.length; i++) {
    lines.push(`${i}. ${state.sequence[i - 1] + 1} -> ${state.sequence[i] + 1}`);
  }

  lines.push("", "Point coordinates, cm from center:");
  const radiusCm = settings.sizeCm / 2;
  for (let i = 0; i < settings.points; i++) {
    const angle = (i / settings.points) * Math.PI * 2;
    const x = Math.cos(angle) * radiusCm;
    const y = Math.sin(angle) * radiusCm;
    lines.push(`${i + 1}: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
  }

  return lines.join("\n");
}

function makeCsvText() {
  const rows = ["step,from,to"];
  for (let i = 1; i < state.sequence.length; i++) {
    rows.push(`${i},${state.sequence[i - 1] + 1},${state.sequence[i] + 1}`);
  }
  return rows.join("\n");
}

function formatSequence(sequence) {
  return sequence.map((point) => point + 1).join(" -> ");
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function setStatus(text) {
  statusText.textContent = text;
}

function setExportEnabled(enabled) {
  pngButton.disabled = !enabled;
  txtButton.disabled = !enabled;
  csvButton.disabled = !enabled;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  downloadUrl(filename, URL.createObjectURL(blob));
}

function downloadDataUrl(filename, url) {
  downloadUrl(filename, url);
}

function downloadUrl(filename, url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function circularDistance(a, b, count) {
  const direct = Math.abs(a - b);
  return Math.min(direct, count - direct);
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Number.parseInt(value, 10) || min));
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number.parseFloat(value) || min));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothStep(edge0, edge1, value) {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
