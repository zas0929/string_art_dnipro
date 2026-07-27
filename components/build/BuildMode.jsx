"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import Minus from "lucide-react/dist/esm/icons/minus.mjs";
import Pause from "lucide-react/dist/esm/icons/pause.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import MapPin from "lucide-react/dist/esm/icons/map-pin.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
import Upload from "lucide-react/dist/esm/icons/upload.mjs";
import Volume2 from "lucide-react/dist/esm/icons/volume-2.mjs";
import VolumeX from "lucide-react/dist/esm/icons/volume-x.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useEffect, useReducer, useRef, useState } from "react";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

import {
  buildSessionReducer,
  findRecentPointMatches,
  initialBuildSessionState,
} from "../../core/build-session.js";
import { parseSchemeText } from "../../core/scheme-format.js";
import {
  createCirclePoints,
  renderStringArtBase,
  renderStringArtLines,
  STRING_ART_WORK_SIZE,
} from "../../core/string-art-renderer.js";
import {
  loadBuildProgress,
  loadLatestPattern,
  saveBuildProgress,
  saveLatestPattern,
} from "../../storage/local-project-store.js";

export default function BuildMode() {
  const { t } = useLanguage();
  const [state, dispatch] = useReducer(buildSessionReducer, initialBuildSessionState);
  const [message, setMessage] = useState("");
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const primedSpeechRef = useRef(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return undefined;
    const speech = window.speechSynthesis;
    const warmVoices = () => speech.getVoices();
    warmVoices();
    speech.addEventListener("voiceschanged", warmVoices);
    return () => speech.removeEventListener("voiceschanged", warmVoices);
  }, []);

  useEffect(() => {
    let active = true;
    loadLatestPattern()
      .then(async (pattern) => {
        if (!active) return;
        if (!pattern) {
          dispatch({ type: "HYDRATE_EMPTY" });
          return;
        }
        const progress = await loadBuildProgress(pattern.id);
        if (active) dispatch({ type: "LOAD_PATTERN", pattern, progress });
      })
      .catch((error) => {
        if (!active) return;
        setMessage(t("build.restoreError", { error: error.message }));
        dispatch({ type: "HYDRATE_EMPTY" });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!state.hydrated || !state.pattern) return;
    const timeout = window.setTimeout(() => {
      saveBuildProgress({
        patternId: state.pattern.id,
        stepIndex: state.stepIndex,
        speedMs: state.speedMs,
        voiceEnabled: state.voiceEnabled,
        updatedAt: new Date().toISOString(),
      }).catch((error) => setMessage(t("build.saveError", { error: error.message })));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [state.hydrated, state.pattern, state.stepIndex, state.speedMs, state.voiceEnabled]);

  useEffect(() => {
    if (state.playback !== "playing" || !state.pattern) return;
    const nextPoint = state.pattern.sequence[state.stepIndex + 1];
    if (!nextPoint) return;

    let cancelled = false;
    let advanceTimeout = 0;
    let speechWatchdog = 0;
    const scheduleAdvance = (delay = state.speedMs) => {
      if (cancelled || advanceTimeout) return;
      window.clearTimeout(speechWatchdog);
      const durationMs = Math.max(0, Number(delay) || 0);
      advanceTimeout = window.setTimeout(() => dispatch({ type: "ADVANCE" }), durationMs);
    };

    if (state.voiceEnabled) {
      const primedSpeech = primedSpeechRef.current?.stepIndex === state.stepIndex
        ? primedSpeechRef.current.run
        : speakBuildPoint(nextPoint, setMessage, t);
      primedSpeechRef.current = null;
      speechWatchdog = window.setTimeout(
        () => scheduleAdvance(0),
        state.speedMs + 1800,
      );
      primedSpeech.finished.then((result) => {
        const fallbackSpeechTime = result === "ended" ? 0 : 800;
        scheduleAdvance(state.speedMs + fallbackSpeechTime);
      });
    } else {
      scheduleAdvance();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(advanceTimeout);
      window.clearTimeout(speechWatchdog);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [state.pattern, state.playback, state.stepIndex, state.speedMs, state.voiceEnabled]);

  const handlePlaybackToggle = () => {
    if (state.playback !== "playing") setMessage("");
    if (state.playback === "playing") {
      primedSpeechRef.current = null;
    }
    if (state.playback !== "playing" && state.voiceEnabled && state.pattern) {
      const nextPoint = state.pattern.sequence[state.stepIndex + 1];
      if (nextPoint) {
        primedSpeechRef.current = {
          stepIndex: state.stepIndex,
          run: speakBuildPoint(nextPoint, setMessage, t),
        };
      }
    }
    dispatch({ type: "TOGGLE_PLAY" });
  };

  const handleSchemeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const sequence = parseSchemeText(await file.text());
      const pattern = {
        id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()),
        name: file.name.replace(/\.[^.]+$/, ""),
        sequence,
        pointCount: Math.max(...sequence),
        lineCount: sequence.length - 1,
        algorithm: "reference-v7",
        threadMm: 0.19,
        createdAt: new Date().toISOString(),
      };
      await saveLatestPattern(pattern);
      dispatch({ type: "LOAD_PATTERN", pattern, progress: null });
      setMessage(t("build.uploadSuccess"));
    } catch (error) {
      setMessage(t("build.patternError", { error: error.message }));
    } finally {
      event.target.value = "";
    }
  };

  const openLostDialog = () => {
    dispatch({ type: "PAUSE" });
    setLostDialogOpen(true);
  };

  const restoreLostPosition = (stepIndex) => {
    dispatch({ type: "SEEK", stepIndex });
    setLostDialogOpen(false);
    setMessage(t("build.restored", { count: stepIndex }));
  };

  const changeSpeed = (delta) => {
    dispatch({ type: "SET_SPEED", speedMs: state.speedMs + delta });
  };

  if (!state.hydrated) {
    return (
      <main className="build-loading">
        <LanguageSwitch />
        <span>{t("build.loading")}</span>
      </main>
    );
  }

  const total = state.pattern ? state.pattern.sequence.length - 1 : 0;
  const complete = state.stepIndex >= total && total > 0;
  const fromPoint = state.pattern?.sequence[Math.min(state.stepIndex, total)] ?? null;
  const toPoint = complete ? null : state.pattern?.sequence[state.stepIndex + 1] ?? null;
  const progressPercent = total ? Math.round((state.stepIndex / total) * 100) : 0;
  const routeContext = complete || !state.pattern
    ? []
    : Array.from({ length: 7 }, (_, index) => {
        const offset = index - 3;
        const sequenceIndex = state.stepIndex + 1 + offset;
        return {
          offset,
          point: state.pattern.sequence[sequenceIndex] ?? null,
        };
      });

  return (
    <main className="build-page">
      <LanguageSwitch />
      <input
        id="buildSchemeInput"
        className="build-scheme-input"
        type="file"
        accept=".txt,.csv,text/plain,text/csv"
        onChange={handleSchemeUpload}
      />
      <section className="build-workspace">
        <header className="build-header">
          <a className="back-link" href="/">
            <ArrowLeft aria-hidden="true" size={18} />
            {t("common.generator")}
          </a>
          <div className="build-header-actions">
            <button
              className="voice-icon-toggle"
              type="button"
              title={state.voiceEnabled ? t("build.voiceOff") : t("build.voiceOn")}
              aria-label={state.voiceEnabled ? t("build.voiceOffAria") : t("build.voiceOnAria")}
              aria-pressed={state.voiceEnabled}
              onClick={() => dispatch({ type: "SET_VOICE", enabled: !state.voiceEnabled })}
            >
              {state.voiceEnabled
                ? <Volume2 aria-hidden="true" size={20} />
                : <VolumeX aria-hidden="true" size={20} />}
            </button>
            <label className="file-button desktop-scheme-upload" htmlFor="buildSchemeInput">
              <Upload aria-hidden="true" size={18} />
              {t("build.uploadPattern")}
            </label>
          </div>
        </header>

        {state.pattern ? (
          <>
            <BuildCanvas
              pattern={state.pattern}
              stepIndex={state.stepIndex}
              playback={state.playback}
              speedMs={state.speedMs}
            />

            <div className="build-progress-line">
              <span>{t("build.stepOf", {
                current: Math.min(state.stepIndex + 1, total),
                total,
              })}</span>
              <strong>{progressPercent}%</strong>
            </div>
            <input
              className="build-seek"
              type="range"
              min="0"
              max={total}
              step="1"
              value={state.stepIndex}
              aria-label={t("build.goToStep")}
              onChange={(event) => dispatch({ type: "SEEK", stepIndex: event.target.value })}
            />

            <div className="build-route" aria-live="polite">
              {complete ? (
                <div className="build-complete">
                  <span>{t("build.completed")}</span>
                  <strong>{total}</strong>
                  <small>{t("build.connectionsCompleted")}</small>
                </div>
              ) : (
                <>
                  <div className="nail-readout" aria-label={t("build.fromPin", { point: fromPoint })}>
                    <strong>{fromPoint}</strong>
                  </div>
                  <ChevronRight className="route-arrow" aria-hidden="true" size={52} />
                  <div className="nail-readout is-next" aria-label={t("build.toPin", { point: toPoint })}>
                    <strong>{toPoint}</strong>
                  </div>
                </>
              )}
            </div>

            {!complete && (
              <div className="route-history" aria-label={t("build.routeAria")}>
                <span className="route-history-label">{t("build.recent")}</span>
                <ol>
                  {routeContext.map(({ offset, point }) => (
                    <li
                      key={offset}
                      className={`${offset < 0 ? "is-past" : ""} ${offset === 0 ? "is-current" : ""} ${point === null ? "is-empty" : ""}`}
                      aria-current={offset === 0 ? "step" : undefined}
                      aria-label={point === null
                        ? undefined
                        : t(
                          offset < 0
                            ? "build.previousPin"
                            : offset === 0
                              ? "build.currentPin"
                              : "build.nextPin",
                          { point },
                        )}
                    >
                      <span aria-hidden="true">{point ?? "·"}</span>
                    </li>
                  ))}
                </ol>
                <span className="route-history-label">{t("build.next")}</span>
              </div>
            )}

            <div className="build-transport">
              <button type="button" onClick={() => dispatch({ type: "PREVIOUS" })} disabled={state.stepIndex === 0}>
                <ChevronLeft aria-hidden="true" size={20} />
                {t("build.back")}
              </button>
              <button
                className="primary-transport"
                type="button"
                onClick={handlePlaybackToggle}
                disabled={complete}
              >
                {state.playback === "playing"
                  ? <Pause aria-hidden="true" size={20} fill="currentColor" />
                  : <Play aria-hidden="true" size={20} fill="currentColor" />}
                {state.playback === "playing" ? t("build.pause") : t("build.start")}
              </button>
              <button type="button" onClick={() => dispatch({ type: "NEXT" })} disabled={complete}>
                {t("build.next")}
                <ChevronRight aria-hidden="true" size={20} />
              </button>
            </div>

            <div className="build-speed-control">
              <div className="build-speed-heading">
                <label htmlFor="buildSpeedInput">{t("build.pauseBetween")}</label>
                <output htmlFor="buildSpeedInput">
                  {t("build.seconds", { value: (state.speedMs / 1000).toFixed(2) })}
                </output>
              </div>
              <div className="build-speed-row">
                <button
                  type="button"
                  title={t("build.faster")}
                  aria-label={t("build.shortenPause")}
                  disabled={state.speedMs <= 500}
                  onClick={() => changeSpeed(-250)}
                >
                  <Minus aria-hidden="true" size={18} />
                </button>
                <input
                  id="buildSpeedInput"
                  type="range"
                  min="500"
                  max="5000"
                  step="250"
                  value={state.speedMs}
                  aria-label={t("build.seconds", { value: (state.speedMs / 1000).toFixed(2) })}
                  onChange={(event) => dispatch({
                    type: "SET_SPEED",
                    speedMs: event.target.value,
                  })}
                />
                <button
                  type="button"
                  title={t("build.slower")}
                  aria-label={t("build.increasePause")}
                  disabled={state.speedMs >= 5000}
                  onClick={() => changeSpeed(250)}
                >
                  <Plus aria-hidden="true" size={18} />
                </button>
              </div>
            </div>

            <button className="lost-position-button" type="button" onClick={openLostDialog}>
              <MapPin aria-hidden="true" size={18} />
              {t("build.lost")}
            </button>
          </>
        ) : (
          <div className="empty-build-state">
            <strong>{t("build.noPattern")}</strong>
            <span>{t("build.noPatternHint")}</span>
          </div>
        )}

        {message && <p className="build-message" aria-live="polite">{message}</p>}
      </section>

      <aside className="build-controls">
        <button
          type="button"
          onClick={() => dispatch({ type: "RESET" })}
          disabled={!state.pattern || state.stepIndex === 0}
        >
          <RotateCcw aria-hidden="true" size={18} />
          {t("build.startOver")}
        </button>

        {state.pattern && (
          <dl className="build-summary">
            <div><dt>{t("build.name")}</dt><dd>{state.pattern.name}</dd></div>
            <div><dt>{t("panel.pins")}</dt><dd>{state.pattern.pointCount}</dd></div>
            <div><dt>{t("panel.lines")}</dt><dd>{total}</dd></div>
            <div><dt>{t("build.saved")}</dt><dd>{t("build.steps", { count: state.stepIndex })}</dd></div>
          </dl>
        )}
        <label className="file-button mobile-scheme-upload" htmlFor="buildSchemeInput">
          <Upload aria-hidden="true" size={18} />
          {t("build.uploadPattern")}
        </label>
      </aside>

      {lostDialogOpen && (
        <LostPositionDialog
          sequence={state.pattern.sequence}
          pointCount={state.pattern.pointCount}
          t={t}
          onClose={() => setLostDialogOpen(false)}
          onRestore={restoreLostPosition}
        />
      )}
    </main>
  );
}

function LostPositionDialog({ sequence, pointCount, onClose, onRestore, t }) {
  const [points, setPoints] = useState(["", "", ""]);
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState("");
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const updatePoint = (index, value) => {
    setPoints((current) => current.map(
      (point, pointIndex) => pointIndex === index ? value : point,
    ));
    setMatches(null);
    setError("");
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const parsedPoints = points.map((point) => Number.parseInt(point, 10));
    if (
      parsedPoints.some(
        (point) => !Number.isInteger(point) || point < 1 || point > pointCount,
      )
    ) {
      setError(t("build.invalidPins", { count: pointCount }));
      setMatches(null);
      return;
    }
    setError("");
    setMatches(findRecentPointMatches(sequence, parsedPoints));
  };

  return (
    <div
      className="lost-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="lost-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lost-dialog-title"
      >
        <button
          className="lost-dialog-close"
          type="button"
          title={t("common.close")}
          aria-label={t("common.close")}
          onClick={onClose}
        >
          <X aria-hidden="true" size={20} />
        </button>
        <h2 id="lost-dialog-title">{t("build.findPosition")}</h2>
        <p>{t("build.findHint")}</p>

        <form onSubmit={handleSubmit}>
          <div className="lost-point-inputs">
            {points.map((point, index) => (
              <label key={index}>
                {t("build.pin", { number: index + 1 })}
                <input
                  ref={index === 0 ? firstInputRef : undefined}
                  type="number"
                  min="1"
                  max={pointCount}
                  inputMode="numeric"
                  value={point}
                  aria-label={t("build.recentPin", { number: index + 1 })}
                  onChange={(event) => updatePoint(index, event.target.value)}
                />
              </label>
            ))}
          </div>
          <button className="lost-search-button" type="submit">
            {t("build.find")}
          </button>
        </form>

        {error && <p className="lost-dialog-error" role="alert">{error}</p>}
        {matches?.length === 0 && (
          <p className="lost-dialog-empty" role="status">
            {t("build.notFound")}
          </p>
        )}
        {matches?.length > 0 && (
          <div className="lost-match-section" aria-live="polite">
            <strong>
              {matches.length === 1
                ? t("build.positionFound")
                : t("build.matchesFound", { count: matches.length })}
            </strong>
            <div className="lost-match-list">
              {matches.map((match) => (
                <button
                  key={match.stepIndex}
                  className="lost-match"
                  type="button"
                  onClick={() => onRestore(match.stepIndex)}
                >
                  <span>
                    {t("build.completedConnections", { count: match.stepIndex })}
                  </span>
                  <small>
                    {match.previousPoint === null ? t("build.routeStart") : match.previousPoint}
                    {" · "}
                    {points.join(" → ")}
                    {" · "}
                    {match.nextPoint === null ? t("build.routeDone") : match.nextPoint}
                  </small>
                  <em>{t("build.continueHere")}</em>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function speakBuildPoint(point, reportError, t) {
  let settleSpeech;
  const finished = new Promise((resolve) => {
    settleSpeech = resolve;
  });
  let settled = false;
  const settle = (result) => {
    if (settled) return;
    settled = true;
    settleSpeech(result);
  };

  if (
    typeof window === "undefined"
    || !("speechSynthesis" in window)
    || !("SpeechSynthesisUtterance" in window)
  ) {
    reportError(t("build.voiceUnavailable"));
    settle("unavailable");
    return { started: false, finished };
  }

  try {
    const speech = window.speechSynthesis;
    const voices = speech.getVoices();
    const isUkrainian = (voice) => voice.lang.toLowerCase().startsWith("uk");
    const primaryVoice = voices.find((voice) => voice.default && voice.localService)
      || voices.find((voice) => voice.default)
      || null;
    const fallbackVoice = voices.find((voice) => voice !== primaryVoice && isUkrainian(voice) && voice.localService)
      || voices.find((voice) => voice !== primaryVoice && isUkrainian(voice))
      || null;
    const voiceAttempts = fallbackVoice ? [primaryVoice, fallbackVoice] : [primaryVoice];

    const speakAttempt = (attemptIndex) => {
      const selectedVoice = voiceAttempts[attemptIndex];
      const utterance = new window.SpeechSynthesisUtterance(String(point));
      if (selectedVoice) utterance.lang = selectedVoice.lang;
      utterance.rate = 0.92;
      utterance.volume = 1;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onend = () => settle("ended");
      utterance.onerror = (event) => {
        if (
          event.error !== "canceled"
          && event.error !== "interrupted"
          && attemptIndex + 1 < voiceAttempts.length
        ) {
          speakAttempt(attemptIndex + 1);
          return;
        }
        if (event.error !== "canceled" && event.error !== "interrupted") {
          reportError(t("build.voiceStartError"));
        }
        settle(event.error || "error");
      };
      speech.speak(utterance);
    };

    if (voiceAttempts.length === 0) {
      reportError(t("build.voiceMissing"));
      settle("unavailable");
    } else {
      speech.resume();
      speakAttempt(0);
    }
    return { started: true, finished };
  } catch {
    reportError(t("build.voiceStartError"));
    settle("error");
    return { started: false, finished };
  }
}

const BUILD_CANVAS_SIZE = 760;
const SEEK_PREVIEW_LINE_LIMIT = 480;

function BuildCanvas({ pattern, stepIndex, playback, speedMs }) {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const renderCacheRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pattern?.sequence?.length) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const sequence = pattern.sequence;
    let renderCache = renderCacheRef.current;
    if (!renderCache || renderCache.pattern !== pattern) {
      const pointCount = Math.max(pattern.pointCount || 0, ...sequence);
      const center = BUILD_CANVAS_SIZE / 2;
      const workCenter = STRING_ART_WORK_SIZE / 2;
      const workPoints = createCirclePoints(
        pointCount,
        workCenter - 8,
        workCenter,
        workCenter,
      );
      const displayPoints = createCirclePoints(pointCount, center - 20, center, center);
      const allLines = [];
      for (let index = 1; index < sequence.length; index++) {
        allLines.push([sequence[index - 1] - 1, sequence[index] - 1]);
      }
      const baseCanvas = document.createElement("canvas");
      baseCanvas.width = BUILD_CANVAS_SIZE;
      baseCanvas.height = BUILD_CANVAS_SIZE;
      const base = baseCanvas.getContext("2d");
      if (!base) return undefined;

      renderStringArtBase(base, pointCount, BUILD_CANVAS_SIZE);
      renderCache = {
        pattern,
        base,
        baseCanvas,
        displayPoints,
        workPoints,
        allLines,
        renderedLines: 0,
      };
      renderCacheRef.current = renderCache;
    }

    const completedLines = Math.max(0, Math.min(stepIndex, renderCache.allLines.length));
    const linesToAdd = completedLines - renderCache.renderedLines;
    const canExtendCurrentFrame = linesToAdd >= 0 && linesToAdd <= 120;
    let needsExactRebuild = !canExtendCurrentFrame;
    let previewFrame = null;
    if (canExtendCurrentFrame && linesToAdd > 0) {
      renderStringArtLines(renderCache.base, renderCache.allLines, renderCache.workPoints, {
        canvasSize: BUILD_CANVAS_SIZE,
        workSize: STRING_ART_WORK_SIZE,
        threadMm: pattern.threadMm ?? 0.19,
        startIndex: renderCache.renderedLines,
        endIndex: completedLines,
      });
      renderCache.renderedLines = completedLines;
    } else if (needsExactRebuild) {
      previewFrame = createSeekPreviewFrame(
        renderCache,
        completedLines,
        pattern.threadMm ?? 0.19,
      );
      if (previewFrame.exact) {
        renderCache.baseCanvas = previewFrame.canvas;
        renderCache.base = previewFrame.context;
        renderCache.renderedLines = completedLines;
        needsExactRebuild = false;
      }
    }

    const { displayPoints } = renderCache;
    const from = displayPoints[sequence[Math.min(stepIndex, sequence.length - 1)] - 1];
    const to = stepIndex < sequence.length - 1 ? displayPoints[sequence[stepIndex + 1] - 1] : null;
    let activeBaseCanvas = previewFrame?.canvas ?? renderCache.baseCanvas;
    let animationStartedAt = performance.now();
    let active = true;
    let animationFrame = 0;
    let rebuildFrame = 0;
    let rebuildTimer = 0;

    const render = (now) => {
      context.clearRect(0, 0, BUILD_CANVAS_SIZE, BUILD_CANVAS_SIZE);
      context.drawImage(activeBaseCanvas, 0, 0);

      if (from && to) {
        const duration = Math.max(300, speedMs * 0.72);
        const rawProgress = playback === "playing"
          ? Math.min(1, (now - animationStartedAt) / duration)
          : 1;
        const x = from.x + (to.x - from.x) * rawProgress;
        const y = from.y + (to.y - from.y) * rawProgress;

        context.save();
        context.beginPath();
        context.moveTo(from.x, from.y);
        context.lineTo(x, y);
        context.strokeStyle = "#2f9c4c";
        context.lineWidth = 3;
        context.stroke();

        context.beginPath();
        context.arc(from.x, from.y, 6, 0, Math.PI * 2);
        context.fillStyle = "#172019";
        context.fill();

        const pulse = playback === "playing" ? Math.sin(now / 110) * 1.4 : 0;
        context.beginPath();
        context.arc(x, y, 7 + pulse, 0, Math.PI * 2);
        context.fillStyle = "#2f9c4c";
        context.fill();
        context.restore();
      }

      if (playback === "playing" && to) animationFrame = requestAnimationFrame(render);
    };

    const restartAnimation = () => {
      cancelAnimationFrame(animationFrame);
      animationStartedAt = performance.now();
      render(animationStartedAt);
    };

    restartAnimation();

    if (needsExactRebuild) {
      rebuildTimer = window.setTimeout(() => {
        if (!active) return;
        const nextCanvas = document.createElement("canvas");
        nextCanvas.width = BUILD_CANVAS_SIZE;
        nextCanvas.height = BUILD_CANVAS_SIZE;
        const nextContext = nextCanvas.getContext("2d");
        if (!nextContext) return;

        renderStringArtBase(
          nextContext,
          renderCache.displayPoints.length,
          BUILD_CANVAS_SIZE,
        );
        let cursor = 0;
        const renderChunk = () => {
          if (!active) return;
          const chunkEnd = Math.min(cursor + 160, completedLines);
          renderStringArtLines(nextContext, renderCache.allLines, renderCache.workPoints, {
            canvasSize: BUILD_CANVAS_SIZE,
            workSize: STRING_ART_WORK_SIZE,
            threadMm: pattern.threadMm ?? 0.19,
            startIndex: cursor,
            endIndex: chunkEnd,
          });
          cursor = chunkEnd;
          if (cursor < completedLines) {
            rebuildFrame = requestAnimationFrame(renderChunk);
            return;
          }

          renderCache.baseCanvas = nextCanvas;
          renderCache.base = nextContext;
          renderCache.renderedLines = completedLines;
          activeBaseCanvas = nextCanvas;
          restartAnimation();
        };
        renderChunk();
      }, 60);
    }

    return () => {
      active = false;
      window.clearTimeout(rebuildTimer);
      cancelAnimationFrame(rebuildFrame);
      cancelAnimationFrame(animationFrame);
    };
  }, [pattern, playback, speedMs, stepIndex]);

  return (
    <div className="build-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="build-canvas"
        width={BUILD_CANVAS_SIZE}
        height={BUILD_CANVAS_SIZE}
        aria-label={t("build.canvasAria")}
      />
    </div>
  );
}

function createSeekPreviewFrame(renderCache, completedLines, threadMm) {
  const canvas = document.createElement("canvas");
  canvas.width = BUILD_CANVAS_SIZE;
  canvas.height = BUILD_CANVAS_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return { canvas, context: renderCache.base, exact: false };

  renderStringArtBase(
    context,
    renderCache.displayPoints.length,
    BUILD_CANVAS_SIZE,
  );
  if (completedLines <= SEEK_PREVIEW_LINE_LIMIT) {
    renderStringArtLines(context, renderCache.allLines, renderCache.workPoints, {
      canvasSize: BUILD_CANVAS_SIZE,
      workSize: STRING_ART_WORK_SIZE,
      threadMm,
      endIndex: completedLines,
    });
    return { canvas, context, exact: true };
  }

  const stride = completedLines / SEEK_PREVIEW_LINE_LIMIT;
  const sampledLines = Array.from(
    { length: SEEK_PREVIEW_LINE_LIMIT },
    (_, index) => renderCache.allLines[
      Math.min(completedLines - 1, Math.floor((index + 0.5) * stride))
    ],
  );
  renderStringArtLines(context, sampledLines, renderCache.workPoints, {
    canvasSize: BUILD_CANVAS_SIZE,
    workSize: STRING_ART_WORK_SIZE,
    threadMm,
    lineAlpha: Math.min(0.42, 0.16 * Math.sqrt(stride)),
  });
  return { canvas, context, exact: false };
}
