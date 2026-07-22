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
import { useEffect, useReducer, useState } from "react";

import { buildSessionReducer, initialBuildSessionState } from "../../core/build-session.js";
import { parseSchemeText } from "../../core/scheme-format.js";
import {
  loadBuildProgress,
  loadLatestPattern,
  saveBuildProgress,
  saveLatestPattern,
} from "../../storage/local-project-store.js";

export default function BuildMode() {
  const [state, dispatch] = useReducer(buildSessionReducer, initialBuildSessionState);
  const [message, setMessage] = useState("");

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

    let advanceTimeout = 0;
    let cancelled = false;
    const scheduleAdvance = () => {
      if (cancelled) return;
      advanceTimeout = window.setTimeout(() => dispatch({ type: "ADVANCE" }), state.speedMs);
    };

    if (state.voiceEnabled && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(String(nextPoint));
      utterance.lang = "ru-RU";
      utterance.rate = 0.92;
      utterance.onend = scheduleAdvance;
      utterance.onerror = scheduleAdvance;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      scheduleAdvance();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(advanceTimeout);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, [state.pattern, state.playback, state.stepIndex, state.speedMs, state.voiceEnabled]);

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
        algorithm: "imported",
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
            <div className="build-progress-line">
              <span>Шаг {Math.min(state.stepIndex + 1, total)} из {total}</span>
              <strong>{progressPercent}%</strong>
            </div>
            <progress className="build-progress" value={state.stepIndex} max={total} />

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

            <div className="build-transport">
              <button type="button" onClick={() => dispatch({ type: "PREVIOUS" })} disabled={state.stepIndex === 0}>
                <ChevronLeft aria-hidden="true" size={20} />
                Назад
              </button>
              <button
                className="primary-transport"
                type="button"
                onClick={() => dispatch({ type: "TOGGLE_PLAY" })}
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
        <button type="button" onClick={() => dispatch({ type: "RESET" })} disabled={!state.pattern || state.stepIndex === 0}>
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
