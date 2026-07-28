import { MAX_POINT_COUNT } from "./limits.js";

export function getBuildVoiceUrl(point, language) {
  const pointNumber = Number(point);
  if (
    !Number.isInteger(pointNumber)
    || pointNumber < 1
    || pointNumber > MAX_POINT_COUNT
  ) {
    return null;
  }

  const voiceLanguage = language === "en" ? "en" : "uk";
  return `/audio/build/${voiceLanguage}/${pointNumber}.m4a`;
}

export function createBuildVoicePlayer(createAudio = () => new Audio()) {
  const audio = createAudio();
  const preloader = createAudio();
  let currentSettle = null;
  let playbackId = 0;

  audio.preload = "auto";
  preloader.preload = "auto";

  const settleCurrent = (result) => {
    if (!currentSettle) return;
    const settle = currentSettle;
    currentSettle = null;
    settle(result);
  };

  const stop = () => {
    playbackId += 1;
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
    settleCurrent("canceled");
  };

  const play = (point, language) => {
    stop();
    const url = getBuildVoiceUrl(point, language);
    if (!url) {
      return {
        started: false,
        finished: Promise.resolve("unavailable"),
      };
    }

    const activePlaybackId = playbackId;
    const finished = new Promise((resolve) => {
      currentSettle = resolve;
    });
    audio.src = url;
    audio.currentTime = 0;
    audio.onended = () => {
      if (activePlaybackId === playbackId) settleCurrent("ended");
    };
    audio.onerror = () => {
      if (activePlaybackId === playbackId) settleCurrent("error");
    };

    try {
      audio.load();
      const playRequest = audio.play();
      if (playRequest?.catch) {
        playRequest.catch(() => {
          if (activePlaybackId === playbackId) settleCurrent("error");
        });
      }
      return { started: true, finished };
    } catch {
      settleCurrent("error");
      return { started: false, finished };
    }
  };

  const preload = (point, language) => {
    const url = getBuildVoiceUrl(point, language);
    if (!url || preloader.src.endsWith(url)) return;
    preloader.src = url;
    preloader.load();
  };

  const dispose = () => {
    stop();
    audio.removeAttribute("src");
    preloader.removeAttribute("src");
    audio.load();
    preloader.load();
  };

  return {
    play,
    preload,
    stop,
    dispose,
  };
}
