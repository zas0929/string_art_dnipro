import assert from "node:assert/strict";
import test from "node:test";

import {
  createBuildVoicePlayer,
  getBuildVoiceUrl,
} from "../core/build-voice-player.js";

test("selects a bundled voice file from the active site language", () => {
  assert.equal(getBuildVoiceUrl(50, "uk"), "/audio/build/uk/50.m4a");
  assert.equal(getBuildVoiceUrl(50, "en"), "/audio/build/en/50.m4a");
  assert.equal(getBuildVoiceUrl(50, "unsupported"), "/audio/build/uk/50.m4a");
  assert.equal(getBuildVoiceUrl(0, "en"), null);
  assert.equal(getBuildVoiceUrl(320, "uk"), "/audio/build/uk/320.m4a");
  assert.equal(getBuildVoiceUrl(321, "uk"), null);
});

test("reuses one audio player and settles when playback ends", async () => {
  const audio = createFakeAudio();
  const preloader = createFakeAudio();
  const player = createBuildVoicePlayer(
    () => (audio.claimed ? preloader : Object.assign(audio, { claimed: true })),
  );

  const run = player.play(173, "uk");
  assert.equal(run.started, true);
  assert.equal(audio.src, "/audio/build/uk/173.m4a");
  assert.equal(audio.playCalls, 1);
  audio.onended();
  assert.equal(await run.finished, "ended");

  player.preload(174, "en");
  assert.equal(preloader.src, "/audio/build/en/174.m4a");
  player.dispose();
});

function createFakeAudio() {
  return {
    claimed: false,
    src: "",
    currentTime: 0,
    preload: "",
    playCalls: 0,
    onended: null,
    onerror: null,
    load() {},
    pause() {},
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    },
    removeAttribute(attribute) {
      if (attribute === "src") this.src = "";
    },
  };
}
