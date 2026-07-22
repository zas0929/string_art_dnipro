export const initialBuildSessionState = {
  hydrated: false,
  pattern: null,
  stepIndex: 0,
  playback: "paused",
  speedMs: 1500,
  voiceEnabled: true,
};

export function buildSessionReducer(state, action) {
  switch (action.type) {
    case "HYDRATE_EMPTY":
      return { ...initialBuildSessionState, hydrated: true };
    case "LOAD_PATTERN": {
      const total = Math.max(0, action.pattern.sequence.length - 1);
      const stepIndex = clampStep(action.progress?.stepIndex ?? 0, total);
      return {
        hydrated: true,
        pattern: action.pattern,
        stepIndex,
        playback: stepIndex >= total ? "complete" : "paused",
        speedMs: clampSpeed(action.progress?.speedMs ?? 1500),
        voiceEnabled: action.progress?.voiceEnabled ?? true,
      };
    }
    case "TOGGLE_PLAY":
      if (!state.pattern || state.playback === "complete") return state;
      return { ...state, playback: state.playback === "playing" ? "paused" : "playing" };
    case "PAUSE":
      return state.playback === "playing" ? { ...state, playback: "paused" } : state;
    case "ADVANCE": {
      if (!state.pattern) return state;
      const total = state.pattern.sequence.length - 1;
      const stepIndex = Math.min(total, state.stepIndex + 1);
      return { ...state, stepIndex, playback: stepIndex >= total ? "complete" : state.playback };
    }
    case "NEXT": {
      if (!state.pattern) return state;
      const total = state.pattern.sequence.length - 1;
      const stepIndex = Math.min(total, state.stepIndex + 1);
      return { ...state, stepIndex, playback: stepIndex >= total ? "complete" : "paused" };
    }
    case "PREVIOUS": {
      if (!state.pattern) return state;
      return { ...state, stepIndex: Math.max(0, state.stepIndex - 1), playback: "paused" };
    }
    case "RESET":
      return state.pattern ? { ...state, stepIndex: 0, playback: "paused" } : state;
    case "SET_SPEED":
      return { ...state, speedMs: clampSpeed(action.speedMs) };
    case "SET_VOICE":
      return { ...state, voiceEnabled: Boolean(action.enabled) };
    default:
      return state;
  }
}

function clampStep(value, total) {
  return Math.max(0, Math.min(total, Number.parseInt(value, 10) || 0));
}

function clampSpeed(value) {
  return Math.max(500, Math.min(5000, Number.parseInt(value, 10) || 1500));
}
