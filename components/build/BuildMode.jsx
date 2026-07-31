"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left.mjs";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right.mjs";
import Minus from "lucide-react/dist/esm/icons/minus.mjs";
import Pause from "lucide-react/dist/esm/icons/pause.mjs";
import Play from "lucide-react/dist/esm/icons/play.mjs";
import MapPin from "lucide-react/dist/esm/icons/map-pin.mjs";
import Mic from "lucide-react/dist/esm/icons/mic.mjs";
import MicOff from "lucide-react/dist/esm/icons/mic-off.mjs";
import MonitorCheck from "lucide-react/dist/esm/icons/monitor-check.mjs";
import MonitorOff from "lucide-react/dist/esm/icons/monitor-off.mjs";
import Plus from "lucide-react/dist/esm/icons/plus.mjs";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw.mjs";
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
import { createBuildVoicePlayer } from "../../core/build-voice-player.js";
import { parseBuildVoiceCommand } from "../../core/build-voice-command.js";
import {
  createCirclePoints,
  renderStringArtBase,
  renderStringArtLines,
  STRING_ART_WORK_SIZE,
} from "../../core/string-art-renderer.js";
import { getProjectStore } from "../../storage/project-store.js";

const ACTIVE_THREAD_COLOR = "#c79b67";

export default function BuildMode() {
  const { language, t } = useLanguage();
  const [state, dispatch] = useReducer(buildSessionReducer, initialBuildSessionState);
  const [message, setMessage] = useState("");
  const [wakeLockEnabled, setWakeLockEnabled] = useState(true);
  const [wakeLockNotice, setWakeLockNotice] = useState("");
  const [speechControlEnabled, setSpeechControlEnabled] = useState(false);
  const [speechControlSupported, setSpeechControlSupported] = useState(null);
  const [speechControlNotice, setSpeechControlNotice] = useState("");
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const primedSpeechRef = useRef(null);
  const voicePlayerRef = useRef(null);
  const projectStoreRef = useRef(null);
  const wakeLockRef = useRef(null);
  const wakeLockRequestRef = useRef(null);
  const keepScreenAwakeRef = useRef(true);
  const speechRecognitionRef = useRef(null);
  const speechRestartTimerRef = useRef(0);
  const keepListeningRef = useRef(false);
  const speechCommandHandlerRef = useRef(null);
  const lastSpeechCommandRef = useRef({ transcript: "", at: 0 });
  const languageRef = useRef(language);
  const translationRef = useRef(t);
  languageRef.current = language;
  translationRef.current = t;

  useEffect(() => {
    if (typeof Audio === "undefined") return undefined;
    const player = createBuildVoicePlayer();
    voicePlayerRef.current = player;
    return () => {
      player.dispose();
      voicePlayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!wakeLockNotice) return undefined;
    const timeout = window.setTimeout(() => setWakeLockNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [wakeLockNotice]);

  useEffect(() => {
    if (!speechControlNotice) return undefined;
    const timeout = window.setTimeout(() => setSpeechControlNotice(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [speechControlNotice]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechControlSupported(false);
      return undefined;
    }

    setSpeechControlSupported(true);
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = speechRecognitionLanguage(languageRef.current);
    speechRecognitionRef.current = recognition;

    const restart = () => {
      window.clearTimeout(speechRestartTimerRef.current);
      if (!keepListeningRef.current || document.visibilityState !== "visible") return;
      speechRestartTimerRef.current = window.setTimeout(() => {
        if (!keepListeningRef.current) return;
        recognition.lang = speechRecognitionLanguage(languageRef.current);
        try {
          recognition.start();
        } catch (error) {
          if (error?.name !== "InvalidStateError") {
            keepListeningRef.current = false;
            setSpeechControlEnabled(false);
            setSpeechControlNotice(translationRef.current("build.voiceControlStartError"));
          }
        }
      }, 240);
    };

    recognition.onstart = () => setSpeechControlEnabled(true);
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (!result.isFinal) continue;
        const transcript = result[0]?.transcript?.trim();
        if (!transcript) continue;
        const now = Date.now();
        const previous = lastSpeechCommandRef.current;
        if (previous.transcript === transcript && now - previous.at < 900) continue;
        lastSpeechCommandRef.current = { transcript, at: now };
        speechCommandHandlerRef.current?.(transcript);
      }
    };
    recognition.onerror = (event) => {
      if (event.error === "aborted" || event.error === "no-speech") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        keepListeningRef.current = false;
        setSpeechControlEnabled(false);
        setSpeechControlNotice(translationRef.current("build.voiceControlPermissionDenied"));
        return;
      }
      if (event.error === "audio-capture") {
        keepListeningRef.current = false;
        setSpeechControlEnabled(false);
        setSpeechControlNotice(translationRef.current("build.voiceControlNoMicrophone"));
        return;
      }
      setSpeechControlNotice(translationRef.current("build.voiceControlError"));
    };
    recognition.onend = () => {
      if (keepListeningRef.current) restart();
      else setSpeechControlEnabled(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") restart();
      else recognition.abort();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      keepListeningRef.current = false;
      window.clearTimeout(speechRestartTimerRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      recognition.onend = null;
      recognition.abort();
      speechRecognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    recognition.lang = speechRecognitionLanguage(language);
    if (keepListeningRef.current) recognition.abort();
  }, [language]);

  useEffect(() => {
    const restoreWakeLock = () => {
      if (document.visibilityState !== "visible" || !keepScreenAwakeRef.current) return;
      void acquireScreenWakeLock(wakeLockRef, wakeLockRequestRef);
    };

    document.addEventListener("visibilitychange", restoreWakeLock);
    return () => {
      document.removeEventListener("visibilitychange", restoreWakeLock);
      keepScreenAwakeRef.current = false;
      void releaseScreenWakeLock(wakeLockRef);
    };
  }, []);

  useEffect(() => {
    let active = true;
    getProjectStore()
      .then(async (store) => {
        projectStoreRef.current = store;
        const pattern = await store.loadLatestPattern();
        if (!active) return;
        if (!pattern) {
          dispatch({ type: "HYDRATE_EMPTY" });
          return;
        }
        const progress = await store.loadProgress(pattern.id);
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
      const projectStore = projectStoreRef.current;
      if (!projectStore) return;
      projectStore.saveProgress({
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
    keepScreenAwakeRef.current = wakeLockEnabled;
    if (!wakeLockEnabled) {
      void releaseScreenWakeLock(wakeLockRef);
      return;
    }
    if (state.hydrated && state.pattern) {
      void acquireScreenWakeLock(wakeLockRef, wakeLockRequestRef);
    }
  }, [state.hydrated, state.pattern, wakeLockEnabled]);

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
        : playBuildPoint(
          voicePlayerRef.current,
          nextPoint,
          language,
          setMessage,
          t,
        );
      primedSpeechRef.current = null;
      const followingPoint = state.pattern.sequence[state.stepIndex + 2];
      if (followingPoint) {
        voicePlayerRef.current?.preload(followingPoint, language);
      }
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
      voicePlayerRef.current?.stop();
    };
  }, [
    language,
    state.pattern,
    state.playback,
    state.stepIndex,
    state.speedMs,
    state.voiceEnabled,
  ]);

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
          run: playBuildPoint(
            voicePlayerRef.current,
            nextPoint,
            language,
            setMessage,
            t,
          ),
        };
      }
    }
    dispatch({ type: "TOGGLE_PLAY" });
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

  const keepScreenAwake = () => {
    if (!state.pattern || !wakeLockEnabled) return;
    void acquireScreenWakeLock(wakeLockRef, wakeLockRequestRef);
  };

  const toggleWakeLock = async () => {
    const enabled = !wakeLockEnabled;
    setWakeLockEnabled(enabled);
    keepScreenAwakeRef.current = enabled;

    if (!enabled) {
      await releaseScreenWakeLock(wakeLockRef);
      setWakeLockNotice(t("build.wakeLockDisabledNotice"));
      return;
    }

    const acquired = state.pattern
      ? await acquireScreenWakeLock(wakeLockRef, wakeLockRequestRef)
      : true;
    setWakeLockNotice(acquired
      ? t("build.wakeLockEnabledNotice")
      : t("build.wakeLockUnavailableNotice"));
  };

  const toggleSpeechControl = () => {
    const recognition = speechRecognitionRef.current;
    if (keepListeningRef.current) {
      keepListeningRef.current = false;
      window.clearTimeout(speechRestartTimerRef.current);
      recognition?.abort();
      setSpeechControlEnabled(false);
      setSpeechControlNotice(t("build.voiceControlDisabledNotice"));
      return;
    }

    if (!recognition || speechControlSupported === false) {
      setSpeechControlNotice(t("build.voiceControlUnavailable"));
      return;
    }

    keepListeningRef.current = true;
    recognition.lang = speechRecognitionLanguage(language);
    try {
      recognition.start();
      setSpeechControlEnabled(true);
      setSpeechControlNotice(t("build.voiceControlEnabledNotice"));
    } catch (error) {
      if (error?.name !== "InvalidStateError") {
        keepListeningRef.current = false;
        setSpeechControlEnabled(false);
        setSpeechControlNotice(t("build.voiceControlStartError"));
      }
    }
  };

  speechCommandHandlerRef.current = (transcript) => {
    const command = parseBuildVoiceCommand(transcript, language);
    if (!command || !state.pattern) return;
    setSpeechControlNotice(t("build.voiceCommandAccepted", { command: transcript }));

    switch (command.type) {
      case "play":
        if (state.playback !== "playing" && state.playback !== "complete") {
          handlePlaybackToggle();
        }
        break;
      case "pause":
        primedSpeechRef.current = null;
        voicePlayerRef.current?.stop();
        dispatch({ type: "PAUSE" });
        break;
      case "next":
        dispatch({ type: "NEXT" });
        break;
      case "previous":
        dispatch({ type: "PREVIOUS" });
        break;
      case "repeat": {
        const repeatPoint = state.pattern.sequence[state.stepIndex + 1];
        if (!repeatPoint) break;
        const repeat = () => playBuildPoint(
          voicePlayerRef.current,
          repeatPoint,
          language,
          setMessage,
          t,
        );
        if (state.playback === "playing") {
          dispatch({ type: "PAUSE" });
          window.setTimeout(repeat, 0);
        } else {
          repeat();
        }
        break;
      }
      case "faster":
        changeSpeed(-250);
        break;
      case "slower":
        changeSpeed(250);
        break;
      case "seek":
        dispatch({ type: "SEEK", stepIndex: command.step - 1 });
        break;
      case "lost":
        openLostDialog();
        break;
      case "voice_on":
        dispatch({ type: "SET_VOICE", enabled: true });
        break;
      case "voice_off":
        dispatch({ type: "SET_VOICE", enabled: false });
        break;
      default:
        break;
    }
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
    <main
      className="build-page"
      onPointerDownCapture={keepScreenAwake}
      onKeyDownCapture={keepScreenAwake}
    >
      <LanguageSwitch />
      <section className="build-workspace">
        <header className="build-header">
          <a className="back-link" href="/create">
            <ArrowLeft aria-hidden="true" size={18} />
            {t("common.generator")}
          </a>
          <div className="build-header-actions">
            <button
              className="voice-control-toggle"
              type="button"
              title={speechControlEnabled
                ? t("build.voiceControlOff")
                : t("build.voiceControlOn")}
              aria-label={speechControlEnabled
                ? t("build.voiceControlOffAria")
                : t("build.voiceControlOnAria")}
              aria-pressed={speechControlEnabled}
              disabled={speechControlSupported === false || !state.pattern}
              onClick={toggleSpeechControl}
            >
              {speechControlEnabled
                ? <Mic aria-hidden="true" size={20} />
                : <MicOff aria-hidden="true" size={20} />}
            </button>
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
            <button
              className="wake-lock-toggle"
              type="button"
              title={wakeLockEnabled ? t("build.wakeLockOff") : t("build.wakeLockOn")}
              aria-label={wakeLockEnabled ? t("build.wakeLockOffAria") : t("build.wakeLockOnAria")}
              aria-pressed={wakeLockEnabled}
              onClick={toggleWakeLock}
            >
              {wakeLockEnabled
                ? <MonitorCheck aria-hidden="true" size={20} />
                : <MonitorOff aria-hidden="true" size={20} />}
            </button>
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
      {wakeLockNotice && (
        <div className="wake-lock-toast" role="status" aria-live="polite">
          {wakeLockNotice}
        </div>
      )}
      {speechControlNotice && !wakeLockNotice && (
        <div className="wake-lock-toast" role="status" aria-live="polite">
          {speechControlNotice}
        </div>
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

function playBuildPoint(player, point, language, reportError, t) {
  if (!player) {
    reportError(t("build.voiceUnavailable"));
    return {
      started: false,
      finished: Promise.resolve("unavailable"),
    };
  }

  const run = player.play(point, language);
  if (!run.started) {
    reportError(t("build.voiceStartError"));
  }
  run.finished.then((result) => {
    if (result === "error") reportError(t("build.voiceStartError"));
  });
  return run;
}

function speechRecognitionLanguage(language) {
  return language === "en" ? "en-US" : "uk-UA";
}

async function acquireScreenWakeLock(wakeLockRef, requestRef) {
  if (
    typeof navigator === "undefined"
    || !("wakeLock" in navigator)
    || document.visibilityState !== "visible"
    || wakeLockRef.current
  ) {
    return false;
  }
  if (requestRef.current) return requestRef.current;

  const request = navigator.wakeLock.request("screen")
    .then((sentinel) => {
      wakeLockRef.current = sentinel;
      sentinel.addEventListener("release", () => {
        if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
      }, { once: true });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      if (requestRef.current === request) requestRef.current = null;
    });
  requestRef.current = request;
  return request;
}

async function releaseScreenWakeLock(wakeLockRef) {
  const sentinel = wakeLockRef.current;
  wakeLockRef.current = null;
  if (!sentinel || sentinel.released) return;
  try {
    await sentinel.release();
  } catch {
    // The browser may release the lock first when the page becomes hidden.
  }
}

const BUILD_CANVAS_SIZE = 760;
const SEEK_CHECKPOINT_INTERVAL = 500;

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

      renderStringArtBase(base, pointCount, BUILD_CANVAS_SIZE, { outline: false });
      renderCache = {
        pattern,
        base,
        baseCanvas,
        checkpoints: new Map([[0, cloneCanvas(baseCanvas)]]),
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
    if (canExtendCurrentFrame && linesToAdd > 0) {
      const extendedFrame = renderLinesWithCheckpoints(
        renderCache,
        renderCache.base,
        renderCache.renderedLines,
        completedLines,
        pattern.threadMm ?? 0.19,
      );
      renderCache.baseCanvas = extendedFrame.canvas;
      renderCache.base = extendedFrame.context;
      renderCache.renderedLines = completedLines;
    } else if (!canExtendCurrentFrame) {
      const exactFrame = createExactSeekFrame(
        renderCache,
        completedLines,
        pattern.threadMm ?? 0.19,
      );
      renderCache.baseCanvas = exactFrame.canvas;
      renderCache.base = exactFrame.context;
      renderCache.renderedLines = completedLines;
    }

    const { displayPoints } = renderCache;
    const from = displayPoints[sequence[Math.min(stepIndex, sequence.length - 1)] - 1];
    const to = stepIndex < sequence.length - 1 ? displayPoints[sequence[stepIndex + 1] - 1] : null;
    const activeBaseCanvas = renderCache.baseCanvas;
    let animationStartedAt = performance.now();
    let animationFrame = 0;

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
        context.strokeStyle = ACTIVE_THREAD_COLOR;
        context.lineWidth = 3;
        context.stroke();

        context.beginPath();
        context.arc(from.x, from.y, 6, 0, Math.PI * 2);
        context.fillStyle = "#172019";
        context.fill();

        const pulse = playback === "playing" ? Math.sin(now / 110) * 1.4 : 0;
        context.beginPath();
        context.arc(x, y, 7 + pulse, 0, Math.PI * 2);
        context.fillStyle = ACTIVE_THREAD_COLOR;
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

    return () => {
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

function createExactSeekFrame(renderCache, completedLines, threadMm) {
  const checkpointStep = findNearestCheckpoint(renderCache.checkpoints, completedLines);
  const canvas = cloneCanvas(renderCache.checkpoints.get(checkpointStep));
  const context = canvas.getContext("2d");
  return renderLinesWithCheckpoints(
    renderCache,
    context,
    checkpointStep,
    completedLines,
    threadMm,
  );
}

function renderLinesWithCheckpoints(renderCache, context, startIndex, endIndex, threadMm) {
  let cursor = startIndex;
  while (cursor < endIndex) {
    const nextCheckpoint = (Math.floor(cursor / SEEK_CHECKPOINT_INTERVAL) + 1)
      * SEEK_CHECKPOINT_INTERVAL;
    const chunkEnd = Math.min(endIndex, nextCheckpoint);
    renderStringArtLines(context, renderCache.allLines, renderCache.workPoints, {
      canvasSize: BUILD_CANVAS_SIZE,
      workSize: STRING_ART_WORK_SIZE,
      threadMm,
      startIndex: cursor,
      endIndex: chunkEnd,
    });
    cursor = chunkEnd;
    if (cursor === nextCheckpoint) {
      if (!renderCache.checkpoints.has(cursor)) {
        renderCache.checkpoints.set(cursor, cloneCanvas(context.canvas));
      }
      const continuationCanvas = cloneCanvas(renderCache.checkpoints.get(cursor));
      context = continuationCanvas.getContext("2d");
    }
  }
  return { canvas: context.canvas, context };
}

function findNearestCheckpoint(checkpoints, completedLines) {
  let nearest = 0;
  checkpoints.forEach((_, step) => {
    if (step <= completedLines && step > nearest) nearest = step;
  });
  return nearest;
}

function cloneCanvas(source) {
  const canvas = document.createElement("canvas");
  canvas.width = BUILD_CANVAS_SIZE;
  canvas.height = BUILD_CANVAS_SIZE;
  canvas.getContext("2d")?.drawImage(source, 0, 0);
  return canvas;
}
