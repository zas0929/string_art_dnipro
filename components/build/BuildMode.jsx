"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Upload,
  Volume2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useReducer, useRef, useState } from "react";

import { buildSessionReducer, initialBuildSessionState } from "../../core/build-session.js";
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
  const [state, dispatch] = useReducer(buildSessionReducer, initialBuildSessionState);
  const [message, setMessage] = useState("");
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
        setMessage(`Не удалось восстановить проект: ${error.message}`);
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
      }).catch((error) => setMessage(`Не удалось сохранить прогресс: ${error.message}`));
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
        : speakBuildPoint(nextPoint, setMessage);
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
          run: speakBuildPoint(nextPoint, setMessage),
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
        algorithm: "portrait-v5",
        threadMm: 0.19,
        createdAt: new Date().toISOString(),
      };
      await saveLatestPattern(pattern);
      dispatch({ type: "LOAD_PATTERN", pattern, progress: null });
      setMessage("Схема загружена. Прогресс будет сохраняться автоматически.");
    } catch (error) {
      setMessage(`Ошибка схемы: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  };

  if (!state.hydrated) {
    return <main className="build-loading">Загружаю проект...</main>;
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
      <section className="build-workspace">
        <header className="build-header">
          <div>
            <Link className="back-link" href="/">
              <ArrowLeft aria-hidden="true" size={18} />
              Генератор
            </Link>
            <h1>Режим сборки</h1>
          </div>
          <label className="file-button">
            <Upload aria-hidden="true" size={18} />
            <input type="file" accept=".txt,.csv,text/plain,text/csv" onChange={handleSchemeUpload} />
            Загрузить схему
          </label>
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
              <span>Шаг {Math.min(state.stepIndex + 1, total)} из {total}</span>
              <strong>{progressPercent}%</strong>
            </div>
            <input
              className="build-seek"
              type="range"
              min="0"
              max={total}
              step="1"
              value={state.stepIndex}
              aria-label="Перейти к шагу"
              onChange={(event) => dispatch({ type: "SEEK", stepIndex: event.target.value })}
            />
            <div className="build-seek-limits" aria-hidden="true">
              <span>0</span>
              <span>{total}</span>
            </div>

            <div className="build-route" aria-live="polite">
              {complete ? (
                <div className="build-complete">
                  <span>Схема завершена</span>
                  <strong>{total}</strong>
                  <small>соединений выполнено</small>
                </div>
              ) : (
                <>
                  <div className="nail-readout">
                    <span>От точки</span>
                    <strong>{fromPoint}</strong>
                  </div>
                  <ChevronRight className="route-arrow" aria-hidden="true" size={52} />
                  <div className="nail-readout is-next">
                    <span>К точке</span>
                    <strong>{toPoint}</strong>
                  </div>
                </>
              )}
            </div>

            {!complete && (
              <div className="route-history" aria-label="Недавние и следующие точки">
                <span className="route-history-label">Недавно</span>
                <ol>
                  {routeContext.map(({ offset, point }) => (
                    <li
                      key={offset}
                      className={`${offset < 0 ? "is-past" : ""} ${offset === 0 ? "is-current" : ""} ${point === null ? "is-empty" : ""}`}
                      aria-current={offset === 0 ? "step" : undefined}
                      aria-label={point === null
                        ? undefined
                        : `${offset < 0 ? "Предыдущая" : offset === 0 ? "Текущая" : "Следующая"} точка ${point}`}
                    >
                      <span aria-hidden="true">{point ?? "·"}</span>
                    </li>
                  ))}
                </ol>
                <span className="route-history-label">Далее</span>
              </div>
            )}

            <div className="build-transport">
              <button type="button" onClick={() => dispatch({ type: "PREVIOUS" })} disabled={state.stepIndex === 0}>
                <ChevronLeft aria-hidden="true" size={20} />
                Назад
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
                {state.playback === "playing" ? "Пауза" : "Старт"}
              </button>
              <button type="button" onClick={() => dispatch({ type: "NEXT" })} disabled={complete}>
                Далее
                <ChevronRight aria-hidden="true" size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="empty-build-state">
            <strong>Нет активной схемы</strong>
            <span>Сгенерируйте макет или загрузите файл схемы.</span>
          </div>
        )}

        {message && <p className="build-message">{message}</p>}
      </section>

      <aside className="build-controls">
        <h2>Управление</h2>
        <label>
          Пауза после номера: {(state.speedMs / 1000).toFixed(2)} сек
          <input
            type="range"
            min="500"
            max="5000"
            step="250"
            value={state.speedMs}
            onChange={(event) => dispatch({ type: "SET_SPEED", speedMs: event.target.value })}
          />
        </label>
        <label className="voice-toggle">
          <span><Volume2 aria-hidden="true" size={18} /> Озвучивать точки</span>
          <input
            type="checkbox"
            checked={state.voiceEnabled}
            onChange={(event) => dispatch({ type: "SET_VOICE", enabled: event.target.checked })}
          />
        </label>
        <button
          type="button"
          onClick={() => dispatch({ type: "RESET" })}
          disabled={!state.pattern || state.stepIndex === 0}
        >
          <RotateCcw aria-hidden="true" size={18} />
          Начать заново
        </button>

        {state.pattern && (
          <dl className="build-summary">
            <div><dt>Название</dt><dd>{state.pattern.name}</dd></div>
            <div><dt>Точек</dt><dd>{state.pattern.pointCount}</dd></div>
            <div><dt>Линий</dt><dd>{total}</dd></div>
            <div><dt>Сохранено</dt><dd>{state.stepIndex} шагов</dd></div>
          </dl>
        )}
      </aside>
    </main>
  );
}

function speakBuildPoint(point, reportError) {
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
    reportError("Озвучка недоступна в этом браузере. Сборка продолжится без неё.");
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
          reportError("Не удалось включить озвучку. Сборка продолжится без неё.");
        }
        settle(event.error || "error");
      };
      speech.speak(utterance);
    };

    if (voiceAttempts.length === 0) {
      reportError("На компьютере не найден системный голос. Сборка продолжится без озвучки.");
      settle("unavailable");
    } else {
      speech.resume();
      speakAttempt(0);
    }
    return { started: true, finished };
  } catch {
    reportError("Не удалось включить озвучку. Сборка продолжится без неё.");
    settle("error");
    return { started: false, finished };
  }
}

const BUILD_CANVAS_SIZE = 760;

function BuildCanvas({ pattern, stepIndex, playback, speedMs }) {
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
    if (completedLines < renderCache.renderedLines) {
      renderStringArtBase(renderCache.base, renderCache.displayPoints.length, BUILD_CANVAS_SIZE);
      renderCache.renderedLines = 0;
    }
    if (completedLines > renderCache.renderedLines) {
      renderStringArtLines(renderCache.base, renderCache.allLines, renderCache.workPoints, {
        canvasSize: BUILD_CANVAS_SIZE,
        workSize: STRING_ART_WORK_SIZE,
        threadMm: pattern.threadMm ?? 0.19,
        opticalPreview: true,
        startIndex: renderCache.renderedLines,
        endIndex: completedLines,
      });
      renderCache.renderedLines = completedLines;
    }

    const { baseCanvas, displayPoints } = renderCache;
    const from = displayPoints[sequence[Math.min(stepIndex, sequence.length - 1)] - 1];
    const to = stepIndex < sequence.length - 1 ? displayPoints[sequence[stepIndex + 1] - 1] : null;
    const animationStartedAt = performance.now();
    let animationFrame = 0;

    const render = (now) => {
      context.clearRect(0, 0, BUILD_CANVAS_SIZE, BUILD_CANVAS_SIZE);
      context.drawImage(baseCanvas, 0, 0);

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

    render(animationStartedAt);
    return () => cancelAnimationFrame(animationFrame);
  }, [pattern, playback, speedMs, stepIndex]);

  return (
    <div className="build-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="build-canvas"
        width={BUILD_CANVAS_SIZE}
        height={BUILD_CANVAS_SIZE}
        aria-label="Визуализация сборки картины"
      />
    </div>
  );
}
