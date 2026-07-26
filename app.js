import { formatSchemeText, parseSchemeText } from "./core/scheme-format.js";
import {
  REFERENCE_LINE_STRENGTH,
  REFERENCE_LINE_WIDTH,
  REFERENCE_RECENT_PEG_WINDOW,
  REFERENCE_WORK_SIZE,
  createReferenceTarget,
} from "./core/reference-thread-planner.js";
import {
  createCirclePoints,
  renderNails,
  renderStringArtBase,
  renderStringArtLines,
} from "./core/string-art-renderer.js";
import { saveLatestPattern } from "./storage/local-project-store.js";

const mountedApps = new WeakMap();
const WORK_SIZE = 560;
const ALGORITHM_ID = "reference-v7";

export function mountStringArtApp(root = document) {
  const existingCleanup = mountedApps.get(root);
  if (existingCleanup) return existingCleanup;

  const getElement = (id) => {
    const element = root.querySelector(`#${id}`);
    if (!element) throw new Error(`Не найден обязательный элемент #${id}`);
    return element;
  };

  const resultCanvas = getElement("resultCanvas");
  const sourceCanvas = getElement("sourceCanvas");
  const resultCtx = resultCanvas.getContext("2d");
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!resultCtx || !sourceCtx) throw new Error("Canvas 2D недоступен");

  const imageInput = getElement("imageInput");
  const schemeInput = getElement("schemeInput");
  const pointsInput = getElement("pointsInput");
  const linesInput = getElement("linesInput");
  const sizeInput = getElement("sizeInput");
  const threadInput = getElement("threadInput");
  const skipInput = getElement("skipInput");
  const zoomInput = getElement("zoomInput");
  const zoomValue = getElement("zoomValue");
  const zoomOutButton = getElement("zoomOutButton");
  const zoomInButton = getElement("zoomInButton");
  const resetCropButton = getElement("resetCropButton");
  const buildButton = getElement("buildButton");
  const mobileBuildButton = getElement("mobileBuildButton");
  const buildButtons = [buildButton, mobileBuildButton];
  const pngButton = getElement("pngButton");
  const txtButton = getElement("txtButton");
  const printButton = getElement("printButton");
  const statusText = getElement("status");
  const progress = getElement("progress");
  const pointsOut = getElement("pointsOut");
  const linesOut = getElement("linesOut");
  const stepOut = getElement("stepOut");
  const lengthOut = getElement("lengthOut");
  const sequenceOutput = getElement("sequenceOutput");

  const state = {
    image: null,
    patternId: null,
    points: [],
    sequence: [],
    sequenceDisplayStart: 0,
    cancelled: false,
    running: false,
    activeWorker: null,
    cancelActiveRun: null,
    crop: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startOffsetX: 0,
      startOffsetY: 0,
      pointers: new Map(),
      gesture: null,
    },
  };

  const listenerController = new AbortController();
  let destroyed = false;
  let cropPreviewFrame = 0;

  const listen = (target, type, handler, options = {}) => {
    target.addEventListener(type, handler, {
      ...options,
      signal: listenerController.signal,
    });
  };

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    state.cancelled = true;
    state.crop.dragging = false;
    state.crop.pointers.clear();
    state.crop.gesture = null;
    listenerController.abort();
    if (cropPreviewFrame) cancelAnimationFrame(cropPreviewFrame);
    if (state.cancelActiveRun) state.cancelActiveRun();
    else if (state.activeWorker) state.activeWorker.terminate();
    state.activeWorker = null;
    state.cancelActiveRun = null;
    if (mountedApps.get(root) === cleanup) mountedApps.delete(root);
  };

  mountedApps.set(root, cleanup);
  drawEmpty();

  listen(imageInput, "change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const image = await loadImage(file);
      if (destroyed) return;
      state.image = image;
      state.patternId = null;
      state.sequence = [];
      state.sequenceDisplayStart = 0;
      resetCrop();
      drawPreparedPreview();
      drawInitialResult();
      setCropControlsDisabled(false);
      setBuildButtonsDisabled(false);
      setExportEnabled(false);
      setStatus("Фото загружено. Перетащите фото для выбора кадра или измените масштаб.");
    } catch {
      setStatus("Не удалось загрузить изображение.");
    }
  });

  listen(schemeInput, "change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || state.running) return;

    try {
      const text = await file.text();
      if (!destroyed) importScheme(text);
    } catch (error) {
      setStatus(`Ошибка схемы: ${error instanceof Error ? error.message : "не удалось прочитать файл"}`);
      setExportEnabled(false);
    } finally {
      schemeInput.value = "";
    }
  });

  for (const button of buildButtons) {
    listen(button, "click", () => {
      if (!state.image || state.running) return;
      void generate();
    });
  }

  listen(pngButton, "click", () => {
    downloadDataUrl("string-art-preview.png", resultCanvas.toDataURL("image/png"));
  });
  listen(txtButton, "click", () => {
    downloadText("string-art-scheme.txt", formatSchemeText(state.sequence));
  });
  listen(printButton, "click", async () => {
    if (state.sequence.length < 2 || state.running) return;
    printButton.disabled = true;
    try {
      await persistLatestPattern(readSettings());
      window.location.assign("/print");
    } catch {
      setStatus("Не удалось подготовить инструкцию к печати.");
      printButton.disabled = false;
    }
  });

  listen(pointsInput, "input", () => {
    if (!state.image || state.running) return;
    invalidateResult();
    drawPreparedPreview();
  });

  for (const input of [linesInput, sizeInput, threadInput, skipInput]) {
    listen(input, "input", () => {
      if (!state.image || state.running) return;
      invalidateResult();
    });
  }

  listen(zoomInput, "input", () => {
    if (!state.image || state.running) return;
    setZoom(clampNumber(zoomInput.value, 1, 4));
  });

  listen(zoomOutButton, "click", () => {
    if (!state.image || state.running) return;
    setZoom(state.crop.zoom - 0.05);
  });

  listen(zoomInButton, "click", () => {
    if (!state.image || state.running) return;
    setZoom(state.crop.zoom + 0.05);
  });

  listen(resetCropButton, "click", () => {
    if (!state.image || state.running) return;
    resetCrop();
    invalidateResult();
    drawPreparedPreview();
  });

  listen(sourceCanvas, "pointerdown", (event) => {
    if (!state.image || state.running) return;
    event.preventDefault();
    try {
      sourceCanvas.setPointerCapture(event.pointerId);
    } catch {
      // Some mobile browsers reject capture while a second touch is joining.
    }
    state.crop.dragging = true;
    state.crop.pointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });
    if (state.crop.pointers.size >= 2) {
      beginPinchGesture();
    } else {
      beginPanGesture(event.pointerId, event);
    }
  });

  listen(sourceCanvas, "pointermove", (event) => {
    if (
      !state.crop.dragging
      || !state.crop.pointers.has(event.pointerId)
      || !state.image
      || state.running
    ) {
      return;
    }
    const pointerEvent = event.getCoalescedEvents?.().at(-1) || event;
    state.crop.pointers.set(event.pointerId, {
      clientX: pointerEvent.clientX,
      clientY: pointerEvent.clientY,
    });
    if (state.crop.pointers.size >= 2) {
      if (state.crop.gesture?.type !== "pinch") beginPinchGesture();
      updatePinchGesture();
      return;
    }
    if (
      state.crop.gesture?.type !== "pan"
      || state.crop.pointerId !== event.pointerId
    ) {
      beginPanGesture(event.pointerId, pointerEvent);
    }
    const rect = sourceCanvas.getBoundingClientRect();
    const scale = WORK_SIZE / rect.width;
    state.crop.offsetX = state.crop.startOffsetX
      + (pointerEvent.clientX - state.crop.startClientX) * scale;
    state.crop.offsetY = state.crop.startOffsetY
      + (pointerEvent.clientY - state.crop.startClientY) * scale;
    clampCropToImage();
    drawPreparedPreview();
  });

  listen(sourceCanvas, "pointerup", finishCropPointer);
  listen(sourceCanvas, "pointercancel", finishCropPointer);

  listen(sourceCanvas, "wheel", (event) => {
    if (!state.image || state.running) return;
    event.preventDefault();
    const rect = sourceCanvas.getBoundingClientRect();
    const before = canvasPointToWorkPoint(event, rect);
    const previousZoom = state.crop.zoom;
    const nextZoom = clampNumber(
      previousZoom * (event.deltaY < 0 ? 1.08 : 0.92),
      1,
      4,
    );
    if (nextZoom === previousZoom) return;

    setZoom(nextZoom, before);
  }, { passive: false });

  async function generate() {
    state.cancelled = false;
    state.running = true;
    setBuildButtonsDisabled(true);
    setCropControlsDisabled(true);
    setExportEnabled(false);
    progress.value = 0;
    setStatus("Подготавливаю расчет...");

    const settings = readSettings();
    const prepared = prepareImage(settings);
    const renderedLines = [];
    state.points = buildCirclePoints(
      settings.points,
      WORK_SIZE / 2 - 8,
      WORK_SIZE / 2,
      WORK_SIZE / 2,
    );
    state.sequence = [0];
    state.sequenceDisplayStart = 0;

    drawSourceFromPrepared(prepared, settings);
    drawResultBase(settings);

    try {
      const result = await runReferenceWorker(settings, prepared.target, renderedLines);
      state.cancelled = result.cancelled;
      updateSummary(settings, renderedLines.length);
      sequenceOutput.value = formatSequence(
        state.sequence,
        state.sequenceDisplayStart,
      );
      progress.value = state.cancelled
        ? renderedLines.length / settings.lines
        : 1;
      setStatus(
        state.cancelled
          ? "Построение остановлено. Инструкция сохранена частично."
          : "Готово. Инструкция построена.",
      );
      setExportEnabled(state.sequence.length > 1);
      if (!state.cancelled) scrollToResultOnMobile();
    } catch (error) {
      setStatus(`Ошибка расчета: ${error instanceof Error ? error.message : "неизвестная ошибка"}`);
      setExportEnabled(state.sequence.length > 1);
    } finally {
      if (!destroyed && state.sequence.length > 1) {
        void persistLatestPattern(settings);
      }
      state.activeWorker = null;
      state.cancelActiveRun = null;
      setBuildButtonsDisabled(!state.image);
      state.running = false;
      setCropControlsDisabled(!state.image);
    }
  }

  function runReferenceWorker(settings, target, renderedLines) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./workers/reference-worker.js", import.meta.url),
        { type: "module" },
      );
      let settled = false;

      const finish = (result, error = null) => {
        if (settled) return;
        settled = true;
        worker.terminate();
        if (state.activeWorker === worker) state.activeWorker = null;
        if (state.cancelActiveRun === cancel) state.cancelActiveRun = null;
        if (error) reject(error);
        else resolve(result);
      };
      const cancel = () => finish({ cancelled: true });

      state.activeWorker = worker;
      state.cancelActiveRun = cancel;
      worker.addEventListener("message", (event) => {
        const message = event.data;
        if (message?.type === "progress") {
          const startIndex = renderedLines.length;
          for (const line of message.lines) {
            renderedLines.push(line);
            state.sequence.push(line[1]);
          }
          drawThreadLines(renderedLines, settings, startIndex);
          updateSummary(settings, message.completed);
          progress.value = message.completed / message.total;
          setStatus(`Построено линий: ${message.completed} / ${message.total}`);
        } else if (message?.type === "done") {
          finish({ cancelled: false });
        } else if (message?.type === "error") {
          finish(null, new Error(message.message));
        }
      });
      worker.addEventListener("error", (event) => {
        finish(null, new Error(event.message || "Worker не смог выполнить расчет"));
      });
      worker.postMessage({
        type: "start",
        settings: {
          points: settings.points,
          lines: settings.lines,
          minSkip: settings.minSkip,
          workSize: REFERENCE_WORK_SIZE,
          recentPegWindow: REFERENCE_RECENT_PEG_WINDOW,
          lineStrength: REFERENCE_LINE_STRENGTH,
          lineWidth: REFERENCE_LINE_WIDTH,
        },
        target,
      });
    });
  }

  function readSettings() {
    return {
      points: clampInt(pointsInput.value, 60, 600),
      lines: clampInt(linesInput.value, 100, 8000),
      sizeCm: clampNumber(sizeInput.value, 10, 200),
      threadMm: clampNumber(threadInput.value, 0.05, 1),
      minSkip: clampInt(skipInput.value, 2, 80),
      zoom: state.crop.zoom,
      offsetX: state.crop.offsetX,
      offsetY: state.crop.offsetY,
      algorithm: ALGORITHM_ID,
    };
  }

  function prepareImage(settings) {
    const previewFrame = createSourceFrame(settings, WORK_SIZE);
    paintOutsideCircle(previewFrame, 18);
    previewFrame.ctx.putImageData(previewFrame.imageData, 0, 0);

    const referenceFrame = createSourceFrame(settings, REFERENCE_WORK_SIZE);
    return {
      canvas: previewFrame.canvas,
      target: createReferenceTarget(
        referenceFrame.data,
        REFERENCE_WORK_SIZE,
      ),
    };
  }

  function createSourceFrame(settings, size) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.fillStyle = "white";
    context.fillRect(0, 0, size, size);

    const scale = size / WORK_SIZE;
    const fit = getImageFit(state.image, size, {
      ...settings,
      offsetX: settings.offsetX * scale,
      offsetY: settings.offsetY * scale,
    });
    context.drawImage(state.image, fit.x, fit.y, fit.width, fit.height);

    const imageData = context.getImageData(0, 0, size, size);
    const mask = new Uint8Array(size * size);
    const radius = size / 2 - 8 * scale;
    const center = size / 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = y * size + x;
        const dx = x - center;
        const dy = y - center;
        mask[index] = dx * dx + dy * dy <= radius * radius ? 1 : 0;
      }
    }

    return {
      canvas,
      ctx: context,
      imageData,
      data: imageData.data,
      mask,
    };
  }

  function paintOutsideCircle(frame, value) {
    for (let index = 0; index < frame.mask.length; index++) {
      if (frame.mask[index]) continue;
      const offset = index * 4;
      frame.data[offset] = value;
      frame.data[offset + 1] = value;
      frame.data[offset + 2] = value;
      frame.data[offset + 3] = 255;
    }
  }

  function importScheme(text) {
    const sequence = parseSchemeText(text);
    const maxPoint = Math.max(...sequence);
    const pointCount = Math.max(
      clampInt(pointsInput.value, 60, 600),
      maxPoint,
    );
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
    state.patternId = null;
    setBuildButtonsDisabled(true);
    setCropControlsDisabled(true);
    state.cancelled = false;
    state.sequence = sequence.map((point) => point - 1);
    state.sequenceDisplayStart = 1;
    state.points = buildCirclePoints(
      pointCount,
      WORK_SIZE / 2 - 8,
      WORK_SIZE / 2,
      WORK_SIZE / 2,
    );

    const renderedLines = [];
    for (let index = 1; index < state.sequence.length; index++) {
      renderedLines.push([
        state.sequence[index - 1],
        state.sequence[index],
      ]);
    }

    drawResultBase(settings);
    drawThreadLines(renderedLines, settings);
    drawSchemePlaceholder(pointCount, lineCount);
    updateSummary(settings, lineCount);
    sequenceOutput.value = formatSequence(
      state.sequence,
      state.sequenceDisplayStart,
    );
    progress.value = 1;
    setStatus(`Схема загружена: ${lineCount} шагов, ${lineCount} соединений.`);
    setExportEnabled(true);
    void persistLatestPattern(settings);
  }

  function drawSchemePlaceholder(pointCount, lineCount) {
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.fillStyle = "#101114";
    sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.fillStyle = "#a9b0ba";
    sourceCtx.textAlign = "center";
    sourceCtx.textBaseline = "middle";
    sourceCtx.font = "20px system-ui";
    sourceCtx.fillText(
      "Схема загружена",
      sourceCanvas.width / 2,
      sourceCanvas.height / 2 - 16,
    );
    sourceCtx.font = "14px system-ui";
    sourceCtx.fillText(
      `${pointCount} точек · ${lineCount} соединений`,
      sourceCanvas.width / 2,
      sourceCanvas.height / 2 + 18,
    );
  }

  function drawPreparedPreview() {
    if (!state.image || cropPreviewFrame) return;
    cropPreviewFrame = requestAnimationFrame(() => {
      cropPreviewFrame = 0;
      if (!destroyed && state.image) drawInteractiveSourcePreview();
    });
  }

  function drawInteractiveSourcePreview() {
    const canvasScale = sourceCanvas.width / WORK_SIZE;
    const fit = getImageFit(state.image, WORK_SIZE, {
      zoom: state.crop.zoom,
      offsetX: state.crop.offsetX,
      offsetY: state.crop.offsetY,
    });
    const cropRadius = (WORK_SIZE / 2 - 8) * canvasScale;

    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.fillStyle = "#050506";
    sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.save();
    sourceCtx.beginPath();
    sourceCtx.arc(
      sourceCanvas.width / 2,
      sourceCanvas.height / 2,
      cropRadius,
      0,
      Math.PI * 2,
    );
    sourceCtx.clip();
    sourceCtx.fillStyle = "#fff";
    sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.imageSmoothingEnabled = true;
    sourceCtx.imageSmoothingQuality = "high";
    sourceCtx.drawImage(
      state.image,
      fit.x * canvasScale,
      fit.y * canvasScale,
      fit.width * canvasScale,
      fit.height * canvasScale,
    );
    sourceCtx.restore();
    drawSourceNails();
  }

  function drawSourceNails() {
    const pointCount = clampInt(pointsInput.value, 60, 600);
    drawNails(
      sourceCtx,
      buildCirclePoints(
        pointCount,
        sourceCanvas.width / 2 - 16,
        sourceCanvas.width / 2,
        sourceCanvas.height / 2,
      ),
      sourceCanvas.width,
    );
  }

  function updateZoomControl() {
    const progressRatio = (state.crop.zoom - 1) / 3;
    zoomValue.value = `${Math.round(state.crop.zoom * 100)}%`;
    zoomValue.textContent = zoomValue.value;
    zoomInput.style.setProperty(
      "--zoom-progress",
      `${Math.max(0, Math.min(1, progressRatio)) * 100}%`,
    );
    zoomOutButton.disabled = !state.image || state.running || state.crop.zoom <= 1;
    zoomInButton.disabled = !state.image || state.running || state.crop.zoom >= 4;
  }

  function setZoom(value, anchor = null) {
    const previousZoom = state.crop.zoom;
    const nextZoom = clampNumber(value, 1, 4);
    if (Math.abs(nextZoom - previousZoom) < 0.0001) {
      zoomInput.value = nextZoom.toFixed(2);
      updateZoomControl();
      return;
    }

    const anchorX = anchor?.x ?? WORK_SIZE / 2;
    const anchorY = anchor?.y ?? WORK_SIZE / 2;
    const ratio = nextZoom / previousZoom;
    state.crop.offsetX = anchorX - WORK_SIZE / 2
      - (anchorX - WORK_SIZE / 2 - state.crop.offsetX) * ratio;
    state.crop.offsetY = anchorY - WORK_SIZE / 2
      - (anchorY - WORK_SIZE / 2 - state.crop.offsetY) * ratio;
    state.crop.zoom = nextZoom;
    zoomInput.value = nextZoom.toFixed(2);
    clampCropToImage();
    updateZoomControl();
    invalidateResult(state.sequence.length > 1);
    drawPreparedPreview();
  }

  function resetCrop() {
    state.crop.zoom = 1;
    state.crop.offsetX = 0;
    state.crop.offsetY = 0;
    state.crop.dragging = false;
    state.crop.pointerId = null;
    state.crop.pointers.clear();
    state.crop.gesture = null;
    zoomInput.value = "1";
    updateZoomControl();
  }

  function beginPanGesture(pointerId, pointer) {
    state.crop.gesture = { type: "pan" };
    state.crop.pointerId = pointerId;
    state.crop.startClientX = pointer.clientX;
    state.crop.startClientY = pointer.clientY;
    state.crop.startOffsetX = state.crop.offsetX;
    state.crop.startOffsetY = state.crop.offsetY;
  }

  function beginPinchGesture() {
    const [first, second] = [...state.crop.pointers.values()];
    if (!first || !second) return;
    const rect = sourceCanvas.getBoundingClientRect();
    const midpoint = getPointerMidpoint(first, second);
    state.crop.gesture = {
      type: "pinch",
      startDistance: Math.max(1, getPointerDistance(first, second)),
      startZoom: state.crop.zoom,
      startOffsetX: state.crop.offsetX,
      startOffsetY: state.crop.offsetY,
      startAnchor: canvasPointToWorkPoint(midpoint, rect),
    };
    state.crop.pointerId = null;
  }

  function updatePinchGesture() {
    const [first, second] = [...state.crop.pointers.values()];
    const gesture = state.crop.gesture;
    if (!first || !second || gesture?.type !== "pinch") return;

    const rect = sourceCanvas.getBoundingClientRect();
    const currentAnchor = canvasPointToWorkPoint(
      getPointerMidpoint(first, second),
      rect,
    );
    const nextZoom = clampNumber(
      gesture.startZoom
        * (getPointerDistance(first, second) / gesture.startDistance),
      1,
      4,
    );
    const ratio = nextZoom / gesture.startZoom;
    state.crop.zoom = nextZoom;
    state.crop.offsetX = currentAnchor.x - WORK_SIZE / 2
      - (gesture.startAnchor.x - WORK_SIZE / 2 - gesture.startOffsetX) * ratio;
    state.crop.offsetY = currentAnchor.y - WORK_SIZE / 2
      - (gesture.startAnchor.y - WORK_SIZE / 2 - gesture.startOffsetY) * ratio;
    zoomInput.value = nextZoom.toFixed(2);
    clampCropToImage();
    updateZoomControl();
    drawPreparedPreview();
  }

  function finishCropPointer(event) {
    if (!state.crop.pointers.has(event.pointerId)) return;
    state.crop.pointers.delete(event.pointerId);
    if (sourceCanvas.hasPointerCapture(event.pointerId)) {
      try {
        sourceCanvas.releasePointerCapture(event.pointerId);
      } catch {
        // The browser may already have released capture after touch cancellation.
      }
    }
    if (state.crop.pointers.size >= 2) {
      beginPinchGesture();
      return;
    }
    if (state.crop.pointers.size === 1) {
      const [pointerId, pointer] = state.crop.pointers.entries().next().value;
      beginPanGesture(pointerId, pointer);
      return;
    }

    state.crop.dragging = false;
    state.crop.pointerId = null;
    state.crop.gesture = null;
    invalidateResult();
  }

  function getPointerMidpoint(first, second) {
    return {
      clientX: (first.clientX + second.clientX) / 2,
      clientY: (first.clientY + second.clientY) / 2,
    };
  }

  function getPointerDistance(first, second) {
    return Math.hypot(
      second.clientX - first.clientX,
      second.clientY - first.clientY,
    );
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
    const baseScale = Math.max(
      WORK_SIZE / state.image.width,
      WORK_SIZE / state.image.height,
    );
    const width = state.image.width * baseScale * state.crop.zoom;
    const height = state.image.height * baseScale * state.crop.zoom;
    const maxX = Math.max(0, (width - WORK_SIZE) / 2);
    const maxY = Math.max(0, (height - WORK_SIZE) / 2);
    state.crop.offsetX = Math.max(
      -maxX,
      Math.min(maxX, state.crop.offsetX),
    );
    state.crop.offsetY = Math.max(
      -maxY,
      Math.min(maxY, state.crop.offsetY),
    );
  }

  function invalidateResult(redrawBase = true) {
    state.sequence = [];
    state.sequenceDisplayStart = 0;
    setExportEnabled(false);
    sequenceOutput.value = "";
    pointsOut.textContent = "-";
    linesOut.textContent = "-";
    stepOut.textContent = "-";
    lengthOut.textContent = "-";
    progress.value = 0;
    setStatus("Параметры изменены. Нажмите «Построить», чтобы пересчитать инструкцию.");
    if (state.image && redrawBase) drawInitialResult();
  }

  function drawSourceFromPrepared(prepared, settings) {
    sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.fillStyle = "#050506";
    sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    sourceCtx.drawImage(
      prepared.canvas,
      0,
      0,
      sourceCanvas.width,
      sourceCanvas.height,
    );
    drawNails(
      sourceCtx,
      buildCirclePoints(
        settings.points,
        sourceCanvas.width / 2 - 16,
        sourceCanvas.width / 2,
        sourceCanvas.height / 2,
      ),
      sourceCanvas.width,
    );
  }

  function drawInitialResult() {
    const settings = readSettings();
    state.points = buildCirclePoints(
      settings.points,
      WORK_SIZE / 2 - 8,
      WORK_SIZE / 2,
      WORK_SIZE / 2,
    );
    drawResultBase(settings);
  }

  function drawResultBase(settings) {
    renderStringArtBase(resultCtx, settings.points, resultCanvas.width, {
      showLabels: false,
    });
  }

  function drawThreadLines(lines, settings, startIndex = 0) {
    renderStringArtLines(resultCtx, lines, state.points, {
      canvasSize: resultCanvas.width,
      workSize: WORK_SIZE,
      threadMm: settings.threadMm,
      startIndex,
    });
  }

  function drawNails(context, points, canvasSize) {
    renderNails(context, points, canvasSize, { showLabels: false });
  }

  function buildCirclePoints(count, radius, centerX, centerY) {
    return createCirclePoints(count, radius, centerX, centerY);
  }

  function drawEmpty() {
    resultCtx.fillStyle = "#f6f3ea";
    resultCtx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
    sourceCtx.fillStyle = "#101114";
    sourceCtx.fillRect(0, 0, sourceCanvas.width, sourceCanvas.height);
    resultCtx.fillStyle = "#5b616b";
    sourceCtx.fillStyle = "#5b616b";
    resultCtx.textAlign = "center";
    sourceCtx.textAlign = "center";
    resultCtx.font = "20px system-ui";
    sourceCtx.font = "20px system-ui";
    resultCtx.fillText(
      "Итоговая нить",
      resultCanvas.width / 2,
      resultCanvas.height / 2,
    );
    sourceCtx.fillText(
      "Подготовленное фото",
      sourceCanvas.width / 2,
      sourceCanvas.height / 2,
    );
  }

  function updateSummary(settings, lineCount) {
    pointsOut.textContent = String(settings.points);
    linesOut.textContent = String(lineCount);
    stepOut.textContent = state.sequence.length > 1
      ? `${state.sequence.at(-2) + 1} -> ${state.sequence.at(-1) + 1}`
      : "-";
    lengthOut.textContent = estimateThreadLength(settings);
  }

  function estimateThreadLength(settings) {
    if (state.sequence.length < 2) return "-";
    const radiusCm = settings.sizeCm / 2;
    let total = 0;
    for (let index = 1; index < state.sequence.length; index++) {
      const from = state.sequence[index - 1];
      const to = state.sequence[index];
      const angle = (
        circularDistance(from, to, settings.points)
        / settings.points
      ) * Math.PI * 2;
      total += 2 * radiusCm * Math.sin(angle / 2);
    }
    return `${(total / 100).toFixed(2)} м`;
  }

  function formatSequence(sequence, startIndex = 0) {
    return sequence
      .slice(startIndex)
      .map((point) => point + 1)
      .join(" -> ");
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = (error) => {
        URL.revokeObjectURL(url);
        reject(error);
      };
      image.src = url;
    });
  }

  function setStatus(text) {
    statusText.textContent = text;
  }

  function setExportEnabled(enabled) {
    pngButton.disabled = !enabled;
    txtButton.disabled = !enabled;
    printButton.disabled = !enabled;
  }

  function setBuildButtonsDisabled(disabled) {
    for (const button of buildButtons) button.disabled = disabled;
  }

  function setCropControlsDisabled(disabled) {
    zoomInput.disabled = disabled;
    resetCropButton.disabled = disabled;
    if (disabled) {
      zoomOutButton.disabled = true;
      zoomInButton.disabled = true;
    } else {
      updateZoomControl();
    }
  }

  function scrollToResultOnMobile() {
    if (!window.matchMedia("(max-width: 720px)").matches) return;
    requestAnimationFrame(() => {
      resultCanvas.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function persistLatestPattern(settings) {
    if (state.sequence.length < 2) return;
    try {
      const id = state.patternId || (typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
      state.patternId = id;
      const sourcePreviewDataUrl = state.image
        ? createSourceFrame(settings, resultCanvas.width).canvas.toDataURL("image/jpeg", 0.9)
        : null;
      await saveLatestPattern({
        id,
        name: "Последняя схема",
        sequence: state.sequence.map((point) => point + 1),
        pointCount: settings.points,
        lineCount: state.sequence.length - 1,
        algorithm: ALGORITHM_ID,
        threadMm: settings.threadMm,
        sourcePreviewDataUrl,
        artworkPreviewDataUrl: resultCanvas.toDataURL("image/png"),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("Не удалось сохранить схему для режима сборки", error);
    }
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

  function circularDistance(from, to, count) {
    const direct = Math.abs(from - to);
    return Math.min(direct, count - direct);
  }

  function clampInt(value, minimum, maximum) {
    return Math.max(
      minimum,
      Math.min(maximum, Number.parseInt(value, 10) || minimum),
    );
  }

  function clampNumber(value, minimum, maximum) {
    return Math.max(
      minimum,
      Math.min(maximum, Number.parseFloat(value) || minimum),
    );
  }

  imageInput.disabled = false;
  schemeInput.disabled = false;

  return cleanup;
}
