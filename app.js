const resultCanvas = document.getElementById("resultCanvas");
const sourceCanvas = document.getElementById("sourceCanvas");
const resultCtx = resultCanvas.getContext("2d", { willReadFrequently: true });
const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });

const imageInput = document.getElementById("imageInput");
const pointsInput = document.getElementById("pointsInput");
const linesInput = document.getElementById("linesInput");
const sizeInput = document.getElementById("sizeInput");
const threadInput = document.getElementById("threadInput");
const opacityInput = document.getElementById("opacityInput");
const skipInput = document.getElementById("skipInput");
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

  drawSourceFromPrepared(prepared, settings);
  drawResultBase(settings);

  for (let line = 0; line < settings.lines; line++) {
    if (state.cancelled) break;

    const next = findBestNextPoint(current, residual, drawn, settings, lineCache);
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
      drawResultBase(settings);
      drawThreadLines(renderedLines, settings);
      updateSummary(settings, line + 1);
      progress.value = (line + 1) / settings.lines;
      setStatus(`Построено линий: ${line + 1} / ${settings.lines}`);
      await waitFrame();
    }
  }

  drawResultBase(settings);
  drawThreadLines(renderedLines, settings);
  updateSummary(settings, renderedLines.length);
  sequenceOutput.value = state.sequence.join(" -> ");
  progress.value = 1;
  setStatus(state.cancelled ? "Построение остановлено. Инструкция сохранена частично." : "Готово. Инструкция построена.");
  setExportEnabled(state.sequence.length > 1);
  buildButton.disabled = false;
  stopButton.disabled = true;
  state.running = false;
}

function readSettings() {
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

  for (let y = 0; y < WORK_SIZE; y++) {
    for (let x = 0; x < WORK_SIZE; x++) {
      const idx = y * WORK_SIZE + x;
      const offset = idx * 4;
      const inside = mask[idx] === 1;
      const value = inside ? 1 - gray[idx] / 255 : 0;
      target[idx] = value;
      if (!inside) {
        data[offset] = 18;
        data[offset + 1] = 18;
        data[offset + 2] = 18;
        data[offset + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return { canvas: temp, target };
}

function findBestNextPoint(current, residual, drawn, settings, lineCache) {
  let best = -1;
  let bestScore = -Infinity;

  for (let candidate = 0; candidate < settings.points; candidate++) {
    if (candidate === current) continue;
    const distance = circularDistance(current, candidate, settings.points);
    if (distance < settings.minSkip) continue;

    const samples = getLineSamples(current, candidate, settings, lineCache);
    let score = 0;
    let overdraw = 0;
    for (let i = 0; i < samples.length; i++) {
      const idx = samples[i];
      score += residual[idx] * residual[idx];
      if (drawn[idx] > residual[idx] + settings.lineStrength) {
        overdraw += drawn[idx] - residual[idx];
      }
    }
    score = score / Math.sqrt(samples.length || 1) - overdraw * 0.018;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
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
    const angle = -Math.PI / 2 + (i / count) * Math.PI * 2;
    points.push({
      x: Math.round(cx + Math.cos(angle) * radius),
      y: Math.round(cy + Math.sin(angle) * radius),
    });
  }
  return points;
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

function drawThreadLines(lines, settings) {
  const scale = resultCanvas.width / WORK_SIZE;
  resultCtx.save();
  resultCtx.beginPath();
  resultCtx.arc(resultCanvas.width / 2, resultCanvas.height / 2, resultCanvas.width / 2 - 20, 0, Math.PI * 2);
  resultCtx.clip();
  resultCtx.globalAlpha = 0.075 + settings.threadMm * 0.32;
  resultCtx.strokeStyle = "#050506";
  resultCtx.lineWidth = Math.max(0.42, settings.threadMm * 3.6);
  for (const [a, b] of lines) {
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
  points.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, dot, 0, Math.PI * 2);
    ctx.fill();
    if (index % Math.ceil(points.length / 30) === 0) {
      const labelX = point.x + (point.x - canvasSize / 2) * 0.035;
      const labelY = point.y + (point.y - canvasSize / 2) * 0.035;
      ctx.fillStyle = "#5c6470";
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index), labelX, labelY);
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
  stepOut.textContent = state.sequence.length > 1 ? `${state.sequence[state.sequence.length - 2]} -> ${state.sequence[state.sequence.length - 1]}` : "-";
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
    "Point 0 is at the top. Numbering goes clockwise.",
    "",
    "Sequence:",
    state.sequence.join(" -> "),
    "",
    "Steps:",
  ];

  for (let i = 1; i < state.sequence.length; i++) {
    lines.push(`${i}. ${state.sequence[i - 1]} -> ${state.sequence[i]}`);
  }

  lines.push("", "Point coordinates, cm from center:");
  const radiusCm = settings.sizeCm / 2;
  for (let i = 0; i < settings.points; i++) {
    const angle = -Math.PI / 2 + (i / settings.points) * Math.PI * 2;
    const x = Math.cos(angle) * radiusCm;
    const y = Math.sin(angle) * radiusCm;
    lines.push(`${i}: x=${x.toFixed(2)}, y=${y.toFixed(2)}`);
  }

  return lines.join("\n");
}

function makeCsvText() {
  const rows = ["step,from,to"];
  for (let i = 1; i < state.sequence.length; i++) {
    rows.push(`${i},${state.sequence[i - 1]},${state.sequence[i]}`);
  }
  return rows.join("\n");
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

function waitFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}
