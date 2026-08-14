import { formatSchemeText, parseSchemeText } from "./core/scheme-format.js";
import { applyImageEnhancements } from "./core/image-enhancements.js";
import { MAX_POINT_COUNT, MIN_POINT_COUNT } from "./core/limits.js";
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
import { getProjectStore } from "./storage/project-store.js";
import {
  LANGUAGE_CHANGE_EVENT,
  getStoredLanguage,
  normalizeLanguage,
  translate,
} from "./core/i18n.js";

const mountedApps = new WeakMap();
const WORK_SIZE = 560;
const ALGORITHM_ID = "reference-v7";
const DEFAULT_RESULT_LINE_COUNT = 4000;
const RENDER_BATCH_SIZE = 40;

export function mountStringArtApp(root = document) {
  const existingCleanup = mountedApps.get(root);
  if (existingCleanup) return existingCleanup;

  const getElement = (id) => {
    const element = root.querySelector(`#${id}`);
    if (!element) throw new Error(`Required element #${id} was not found`);
    return element;
  };
  const getOptionalElement = (id) => root.querySelector(`#${id}`);

  const resultCanvas = getElement("resultCanvas");
  const sourceCanvas = getElement("sourceCanvas");
  const resultCtx = resultCanvas.getContext("2d");
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!resultCtx || !sourceCtx) throw new Error("Canvas 2D is unavailable");

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
  const sharpnessInput = getElement("sharpnessInput");
  const sharpnessValue = getElement("sharpnessValue");
  const clarityInput = getElement("clarityInput");
  const clarityValue = getElement("clarityValue");
  const resultVariants = getElement("resultVariants");
  const variantButtons = [...resultVariants.querySelectorAll("[data-lines]")];
  const buildButton = getElement("buildButton");
  const mobileBuildButton = getElement("mobileBuildButton");
  const buildButtons = [buildButton, mobileBuildButton];
  const pngButton = getOptionalElement("pngButton");
  const txtButton = getOptionalElement("txtButton");
  const printButton = getOptionalElement("printButton");
  const saveProjectButton = getElement("saveProjectButton");
  const saveProjectLabel = getElement("saveProjectLabel");
  const buildModeLink = getElement("buildModeLink");
  const statusText = getElement("status");
  const progress = getElement("progress");
  const pointsOut = getOptionalElement("pointsOut");
  const linesOut = getOptionalElement("linesOut");
  const stepOut = getOptionalElement("stepOut");
  const lengthOut = getOptionalElement("lengthOut");
  const sequenceOutput = getOptionalElement("sequenceOutput");

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
    availableVariants: new Set(),
    resultLines: [],
    resultSettings: null,
    resultNeedsRecalculation: false,
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
  let uiLanguage = getStoredLanguage();
  let currentStatus = { key: null, params: {} };
  let saveLabelKey = "panel.saveProject";
  let saveLabelResetTimer = 0;

  const listen = (target, type, handler, options = {}) => {
    if (!target) return;
    target.addEventListener(type, handler, {
      ...options,
      signal: listenerController.signal,
    });
  };

  listen(window, LANGUAGE_CHANGE_EVENT, (event) => {
    uiLanguage = normalizeLanguage(event.detail?.language);
    renderCurrentStatus();
    renderSaveLabel();
    if (!state.image && state.sequence.length > 1) {
      drawSchemePlaceholder(
        state.resultSettings?.points ?? Math.max(...state.sequence) + 1,
        state.resultLines.length,
      );
    } else if (!state.image) {
      drawEmpty();
    } else if (state.resultNeedsRecalculation) {
      drawInitialResult();
      drawRecalculationPlaceholder();
    }
  });

  const cleanup = () => {
    if (destroyed) return;
    destroyed = true;
    state.cancelled = true;
    state.crop.dragging = false;
    state.crop.pointers.clear();
    state.crop.gesture = null;
    listenerController.abort();
    if (cropPreviewFrame) cancelAnimationFrame(cropPreviewFrame);
    if (saveLabelResetTimer) clearTimeout(saveLabelResetTimer);
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
      state.resultNeedsRecalculation = false;
      clearResultVariants();
      resetCrop();
      drawPreparedPreview();
      drawInitialResult();
      setCropControlsDisabled(false);
      setBuildButtonsDisabled(false);
      setExportEnabled(false);
      setStatus("generator.photoUploaded");
    } catch {
      setStatus("generator.imageLoadError");
    }
  });

  listen(schemeInput, "change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || state.running) return;

    try {
      const text = await file.text();
      if (!destroyed) await importScheme(text);
    } catch (error) {
      setStatus("generator.patternError", {
        error: error instanceof Error ? error.message : t("generator.readFileError"),
      });
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
    exportPng();
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
      setStatus("generator.printError");
      printButton.disabled = false;
    }
  });

  listen(saveProjectButton, "click", async () => {
    if (state.sequence.length < 2 || state.running) return;
    await saveCurrentProject();
  });

  listen(document, "click", (event) => {
    if (event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || state.sequence.length < 2
      || state.running) return;

    const anchor = event.target instanceof Element
      ? event.target.closest('a[href="/build"]')
      : null;
    if (!anchor || (anchor.target && anchor.target !== "_self")) return;

    event.preventDefault();
    void saveCurrentProject().then((saved) => {
      if (saved && !destroyed) window.location.assign(anchor.href);
    });
  });

  listen(pointsInput, "input", () => {
    if (Number(pointsInput.value) > MAX_POINT_COUNT) {
      pointsInput.value = String(MAX_POINT_COUNT);
    }
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

  for (const [input, output] of [
    [sharpnessInput, sharpnessValue],
    [clarityInput, clarityValue],
  ]) {
    listen(input, "input", () => {
      output.value = `${clampInt(input.value, 0, 100)}%`;
      output.textContent = output.value;
      if (!state.image || state.running) return;
      invalidateResult();
      drawPreparedPreview();
    });
  }

  for (const button of variantButtons) {
    listen(button, "click", () => {
      const lineCount = Number.parseInt(button.dataset.lines, 10);
      if (!state.availableVariants.has(lineCount)) return;
      selectResultVariant(lineCount);
    });
  }

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
    state.resultNeedsRecalculation = false;
    setBuildButtonsDisabled(true);
    setCropControlsDisabled(true);
    setExportEnabled(false);
    progress.value = 0;
    setStatus("generator.preparing");

    const settings = readSettings();
    const prepared = prepareImage(settings);
    const renderedLines = [];
    clearResultVariants();
    state.points = buildCirclePoints(
      settings.points,
      WORK_SIZE / 2 - 8,
      WORK_SIZE / 2,
      WORK_SIZE / 2,
    );
    state.sequence = [0];
    state.sequenceDisplayStart = 0;

    drawInteractiveSourcePreview();
    drawResultBase(settings);

    try {
      const result = await runReferenceWorker(settings, prepared.target, renderedLines);
      state.cancelled = result.cancelled;
      updateSummary(settings, renderedLines.length);
      if (sequenceOutput) {
        sequenceOutput.value = formatSequence(
          state.sequence,
          state.sequenceDisplayStart,
        );
      }
      progress.value = state.cancelled
        ? renderedLines.length / settings.lines
        : 1;
      setStatus(state.cancelled ? "generator.stopped" : "generator.ready");
      if (!state.cancelled) configureResultVariants(renderedLines, settings);
      setExportEnabled(state.sequence.length > 1);
      if (!state.cancelled) scrollToResultOnMobile();
    } catch (error) {
      setStatus("generator.calculationError", {
        error: error instanceof Error ? error.message : t("generator.unknownError"),
      });
      setExportEnabled(state.sequence.length > 1);
    } finally {
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
          const previewEnd = Math.min(
            renderedLines.length,
            getDefaultResultLineCount(settings.lines),
          );
          if (startIndex < previewEnd) {
            drawThreadLines(renderedLines, settings, startIndex, previewEnd);
          }
          updateSummary(settings, message.completed);
          progress.value = message.completed / message.total;
          setStatus("generator.generated", {
            completed: message.completed,
            total: message.total,
          });
        } else if (message?.type === "done") {
          finish({ cancelled: false });
        } else if (message?.type === "error") {
          finish(null, new Error(message.message));
        }
      });
      worker.addEventListener("error", (event) => {
        finish(null, new Error(event.message || "The worker could not complete the calculation"));
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
      points: clampInt(pointsInput.value, MIN_POINT_COUNT, MAX_POINT_COUNT),
      lines: clampInt(linesInput.value, 100, 8000),
      sizeCm: clampNumber(sizeInput.value, 10, 200),
      threadMm: clampNumber(threadInput.value, 0.05, 1),
      minSkip: clampInt(skipInput.value, 2, 80),
      zoom: state.crop.zoom,
      offsetX: state.crop.offsetX,
      offsetY: state.crop.offsetY,
      sharpness: clampInt(sharpnessInput.value, 0, 100),
      clarity: clampInt(clarityInput.value, 0, 100),
      algorithm: ALGORITHM_ID,
    };
  }

  function prepareImage(settings) {
    const referenceFrame = createSourceFrame(settings, REFERENCE_WORK_SIZE);
    return {
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
    applyImageEnhancements(imageData, size, size, settings);
    context.putImageData(imageData, 0, 0);

    return {
      canvas,
      ctx: context,
      imageData,
      data: imageData.data,
    };
  }

  async function importScheme(text) {
    const sequence = parseSchemeText(text);
    const maxPoint = Math.max(...sequence);
    const pointCount = Math.max(
      clampInt(pointsInput.value, MIN_POINT_COUNT, MAX_POINT_COUNT),
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
    state.resultNeedsRecalculation = false;
    state.patternId = null;
    setBuildButtonsDisabled(true);
    setCropControlsDisabled(true);
    state.cancelled = false;
    clearResultVariants();
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
    drawThreadLines(
      renderedLines,
      settings,
      0,
      getDefaultResultLineCount(renderedLines.length),
    );
    configureResultVariants(renderedLines, settings);
    drawSchemePlaceholder(pointCount, lineCount);
    updateSummary(settings, lineCount);
    if (sequenceOutput) {
      sequenceOutput.value = formatSequence(
        state.sequence,
        state.sequenceDisplayStart,
      );
    }
    progress.value = 1;
    setExportEnabled(true);
    setStatus("generator.patternUploaded", { count: lineCount });
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
      t("generator.patternCanvasTitle"),
      sourceCanvas.width / 2,
      sourceCanvas.height / 2 - 16,
    );
    sourceCtx.font = "14px system-ui";
    sourceCtx.fillText(
      t("generator.patternCanvasSummary", { points: pointCount, lines: lineCount }),
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
    const settings = readSettings();
    const canvasScale = sourceCanvas.width / WORK_SIZE;
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
    if (
      state.crop.pointers.size === 0
      && (
        settings.sharpness > 0
        || settings.clarity > 0
      )
    ) {
      const frame = createSourceFrame(settings, sourceCanvas.width);
      sourceCtx.drawImage(frame.canvas, 0, 0, sourceCanvas.width, sourceCanvas.height);
    } else {
      const fit = getImageFit(state.image, WORK_SIZE, settings);
      sourceCtx.drawImage(
        state.image,
        fit.x * canvasScale,
        fit.y * canvasScale,
        fit.width * canvasScale,
        fit.height * canvasScale,
      );
    }
    sourceCtx.restore();
    drawSourceNails();
  }

  function drawSourceNails() {
    const pointCount = clampInt(
      pointsInput.value,
      MIN_POINT_COUNT,
      MAX_POINT_COUNT,
    );
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
    drawPreparedPreview();
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
    clearResultVariants();
    state.sequence = [];
    state.sequenceDisplayStart = 0;
    setExportEnabled(false);
    if (sequenceOutput) sequenceOutput.value = "";
    if (pointsOut) pointsOut.textContent = "-";
    if (linesOut) linesOut.textContent = "-";
    if (stepOut) stepOut.textContent = "-";
    if (lengthOut) lengthOut.textContent = "-";
    progress.value = 0;
    state.resultNeedsRecalculation = true;
    setStatus(null);
    if (state.image && redrawBase) {
      drawInitialResult();
      drawRecalculationPlaceholder();
    }
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

  function drawRecalculationPlaceholder() {
    const centerX = resultCanvas.width / 2;
    const centerY = resultCanvas.height / 2;
    resultCtx.save();
    resultCtx.fillStyle = "#5b616b";
    resultCtx.textAlign = "center";
    resultCtx.textBaseline = "middle";
    resultCtx.font = "600 22px system-ui";
    resultCtx.fillText(
      t("generator.settingsChangedTitle"),
      centerX,
      centerY - 16,
    );
    resultCtx.font = "16px system-ui";
    resultCtx.fillText(
      t("generator.settingsChangedAction"),
      centerX,
      centerY + 18,
    );
    resultCtx.restore();
  }

  function drawResultBase(settings) {
    renderStringArtBase(resultCtx, settings.points, resultCanvas.width, {
      showLabels: false,
    });
  }

  function drawThreadLines(
    lines,
    settings,
    startIndex = 0,
    endIndex = lines.length,
  ) {
    renderThreadLinesInBatches(
      resultCtx,
      lines,
      settings,
      startIndex,
      endIndex,
    );
  }

  function renderThreadLinesInBatches(
    context,
    lines,
    settings,
    startIndex = 0,
    endIndex = lines.length,
  ) {
    for (
      let batchStart = startIndex;
      batchStart < endIndex;
      batchStart += RENDER_BATCH_SIZE
    ) {
      renderStringArtLines(context, lines, state.points, {
        canvasSize: context.canvas.width,
        workSize: WORK_SIZE,
        threadMm: settings.threadMm,
        startIndex: batchStart,
        endIndex: Math.min(batchStart + RENDER_BATCH_SIZE, endIndex),
      });
    }
  }

  function configureResultVariants(lines, settings) {
    state.resultLines = lines;
    state.resultSettings = settings;
    const availableLineCounts = [3500, 4000, 4500, 5000]
      .filter((lineCount) => lineCount <= lines.length);
    if (availableLineCounts.length === 0) return;

    state.availableVariants.clear();
    for (const lineCount of availableLineCounts) {
      const frame = renderVariantFrame(lines, settings, lineCount);
      state.availableVariants.add(lineCount);
      const preview = getElement(`resultVariant${lineCount}`);
      const previewContext = preview.getContext("2d");
      previewContext.clearRect(0, 0, preview.width, preview.height);
      previewContext.drawImage(frame, 0, 0, preview.width, preview.height);
      frame.width = 1;
      frame.height = 1;
    }
    for (const button of variantButtons) {
      const lineCount = Number.parseInt(button.dataset.lines, 10);
      button.hidden = !state.availableVariants.has(lineCount);
    }
    resultVariants.hidden = false;
    selectResultVariant(
      state.availableVariants.has(DEFAULT_RESULT_LINE_COUNT)
        ? DEFAULT_RESULT_LINE_COUNT
        : availableLineCounts.at(-1),
    );
  }

  function renderVariantFrame(lines, settings, lineCount) {
    const frame = document.createElement("canvas");
    frame.width = resultCanvas.width;
    frame.height = resultCanvas.height;
    const context = frame.getContext("2d");
    renderStringArtBase(context, settings.points, frame.width, {
      showLabels: false,
    });
    renderThreadLinesInBatches(context, lines, settings, 0, lineCount);
    return frame;
  }

  function renderTransparentExportFrame() {
    if (!state.resultSettings || state.resultLines.length === 0) return null;

    const lineCount = Math.min(
      Number.parseInt(resultCanvas.dataset.lines, 10)
        || getDefaultResultLineCount(state.resultLines.length),
      state.resultLines.length,
    );
    const frame = document.createElement("canvas");
    frame.width = resultCanvas.width;
    frame.height = resultCanvas.height;
    const context = frame.getContext("2d");
    if (!context) return null;

    renderStringArtBase(
      context,
      state.resultSettings.points,
      frame.width,
      {
        showLabels: false,
        background: false,
      },
    );
    renderThreadLinesInBatches(
      context,
      state.resultLines,
      state.resultSettings,
      0,
      lineCount,
    );
    return frame;
  }

  function selectResultVariant(lineCount) {
    if (
      !state.availableVariants.has(lineCount)
      || !state.resultSettings
      || state.resultLines.length === 0
    ) {
      return;
    }
    resultCanvas.width = resultCanvas.width;
    drawResultBase(state.resultSettings);
    drawThreadLines(
      state.resultLines,
      state.resultSettings,
      0,
      lineCount,
    );
    resultCanvas.dataset.lines = String(lineCount);
    for (const button of variantButtons) {
      const selected = Number.parseInt(button.dataset.lines, 10) === lineCount;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
  }

  function clearResultVariants() {
    state.availableVariants.clear();
    state.resultLines = [];
    state.resultSettings = null;
    delete resultCanvas.dataset.lines;
    resultVariants.hidden = true;
    for (const button of variantButtons) {
      button.hidden = false;
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    }
  }

  function getDefaultResultLineCount(totalLines) {
    return Math.min(DEFAULT_RESULT_LINE_COUNT, totalLines);
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
      t("generator.resultCanvas"),
      resultCanvas.width / 2,
      resultCanvas.height / 2,
    );
    sourceCtx.fillText(
      t("generator.preparedPhoto"),
      sourceCanvas.width / 2,
      sourceCanvas.height / 2,
    );
  }

  function updateSummary(settings, lineCount) {
    if (!pointsOut || !linesOut || !stepOut || !lengthOut) return;
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
    return `${(total / 100).toFixed(2)} m`;
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

  function t(key, params) {
    return translate(uiLanguage, key, params);
  }

  function renderCurrentStatus() {
    statusText.textContent = currentStatus.key
      ? t(currentStatus.key, currentStatus.params)
      : "";
  }

  function setStatus(key, params = {}) {
    currentStatus = { key, params };
    renderCurrentStatus();
  }

  function setExportEnabled(enabled) {
    if (pngButton) pngButton.disabled = !enabled;
    if (txtButton) txtButton.disabled = !enabled;
    if (printButton) printButton.disabled = !enabled;
    saveProjectButton.disabled = !enabled;
  }

  async function saveCurrentProject() {
    if (saveLabelResetTimer) {
      clearTimeout(saveLabelResetTimer);
      saveLabelResetTimer = 0;
    }
    saveProjectButton.disabled = true;
    buildModeLink.classList.add("is-disabled");
    setSaveLabel("panel.savingProject");
    try {
      await persistLatestPattern(readSettings());
      setSaveLabel("panel.projectSaved");
      saveLabelResetTimer = window.setTimeout(() => {
        saveLabelResetTimer = 0;
        setSaveLabel("panel.saveProject");
      }, 2200);
      return true;
    } catch {
      setSaveLabel("panel.saveProject");
      return false;
    } finally {
      saveProjectButton.disabled = state.sequence.length < 2 || state.running;
      buildModeLink.classList.remove("is-disabled");
    }
  }

  function setSaveLabel(key) {
    saveLabelKey = key;
    renderSaveLabel();
  }

  function renderSaveLabel() {
    saveProjectLabel.textContent = t(saveLabelKey);
  }

  function setBuildButtonsDisabled(disabled) {
    for (const button of buildButtons) button.disabled = disabled;
  }

  function setCropControlsDisabled(disabled) {
    zoomInput.disabled = disabled;
    sharpnessInput.disabled = disabled;
    clarityInput.disabled = disabled;
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
      const projectStore = await getProjectStore();
      return await projectStore.saveLatestPattern({
        id,
        name: "Latest pattern",
        sequence: state.sequence.map((point) => point + 1),
        pointCount: settings.points,
        lineCount: state.sequence.length - 1,
        algorithm: ALGORITHM_ID,
        threadMm: settings.threadMm,
        sharpness: settings.sharpness,
        clarity: settings.clarity,
        sourcePreviewDataUrl,
        artworkPreviewDataUrl: resultCanvas.toDataURL("image/png"),
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Could not save the generated project", error);
      setStatus("generator.projectSaveError", {
        error: error instanceof Error ? error.message : t("generator.unknownError"),
      });
      throw error;
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    downloadBlob(filename, blob);
  }

  function exportPng() {
    const frame = renderTransparentExportFrame();
    if (!frame) return;

    const filename = "string-art-preview.png";
    const blob = dataUrlToBlob(
      frame.toDataURL("image/png"),
      "application/octet-stream",
    );
    frame.width = 1;
    frame.height = 1;
    downloadBlob(filename, blob);
  }

  function dataUrlToBlob(url, type) {
    const [metadata, encoded] = url.split(",");
    const mimeType = metadata.match(/^data:([^;]+)/)?.[1] || "application/octet-stream";
    const binary = window.atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: type || mimeType });
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    downloadUrl(filename, url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
