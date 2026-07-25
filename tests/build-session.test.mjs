import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSessionReducer,
  findRecentPointMatches,
  initialBuildSessionState,
} from "../core/build-session.js";

const pattern = { id: "test", sequence: [1, 50, 25], lineCount: 2 };

test("hydrates saved progress and clamps it to the sequence", () => {
  const state = buildSessionReducer(initialBuildSessionState, {
    type: "LOAD_PATTERN",
    pattern,
    progress: { stepIndex: 99, speedMs: 9000, voiceEnabled: false },
  });
  assert.equal(state.stepIndex, 2);
  assert.equal(state.playback, "complete");
  assert.equal(state.speedMs, 5000);
  assert.equal(state.voiceEnabled, false);
});

test("plays, advances and pauses at the final connection", () => {
  let state = buildSessionReducer(initialBuildSessionState, { type: "LOAD_PATTERN", pattern });
  state = buildSessionReducer(state, { type: "TOGGLE_PLAY" });
  state = buildSessionReducer(state, { type: "ADVANCE" });
  assert.equal(state.playback, "playing");
  assert.equal(state.stepIndex, 1);
  state = buildSessionReducer(state, { type: "ADVANCE" });
  assert.equal(state.playback, "complete");
  assert.equal(state.stepIndex, 2);
});

test("keeps playing after manual previous and next navigation", () => {
  const longerPattern = { id: "long", sequence: [1, 50, 25, 43], lineCount: 3 };
  let state = buildSessionReducer(initialBuildSessionState, { type: "LOAD_PATTERN", pattern: longerPattern });
  state = buildSessionReducer(state, { type: "TOGGLE_PLAY" });
  state = buildSessionReducer(state, { type: "NEXT" });
  assert.equal(state.playback, "playing");
  assert.equal(state.stepIndex, 1);
  state = buildSessionReducer(state, { type: "PREVIOUS" });
  assert.equal(state.playback, "playing");
  assert.equal(state.stepIndex, 0);
});

test("seeks to any connection and clamps the requested step", () => {
  let state = buildSessionReducer(initialBuildSessionState, { type: "LOAD_PATTERN", pattern });
  state = buildSessionReducer(state, { type: "SEEK", stepIndex: 1 });
  assert.equal(state.stepIndex, 1);
  assert.equal(state.playback, "paused");
  state = buildSessionReducer(state, { type: "SEEK", stepIndex: 999 });
  assert.equal(state.stepIndex, 2);
  assert.equal(state.playback, "complete");
  state = buildSessionReducer(state, { type: "SEEK", stepIndex: 0 });
  assert.equal(state.stepIndex, 0);
  assert.equal(state.playback, "paused");
});

test("finds every route position matching the last entered points", () => {
  const matches = findRecentPointMatches(
    [1, 50, 25, 43, 12, 50, 25, 43, 99],
    [50, 25, 43],
  );
  assert.deepEqual(matches, [
    { stepIndex: 3, previousPoint: 1, nextPoint: 12 },
    { stepIndex: 7, previousPoint: 12, nextPoint: 99 },
  ]);
  assert.deepEqual(findRecentPointMatches([1, 2, 3], [8, 9, 10]), []);
});
