import assert from "node:assert/strict";
import test from "node:test";

import { parseBuildVoiceCommand } from "../core/build-voice-command.js";

test("parses Ukrainian and common Russian build commands", () => {
  assert.deepEqual(parseBuildVoiceCommand("Старт", "uk"), { type: "play" });
  assert.deepEqual(parseBuildVoiceCommand("продолжай", "uk"), { type: "play" });
  assert.deepEqual(parseBuildVoiceCommand("Далі", "uk"), { type: "next" });
  assert.deepEqual(parseBuildVoiceCommand("далее", "uk"), { type: "next" });
  assert.deepEqual(parseBuildVoiceCommand("давай назад", "uk"), { type: "previous" });
  assert.deepEqual(parseBuildVoiceCommand("Ще раз", "uk"), { type: "repeat" });
  assert.deepEqual(parseBuildVoiceCommand("БЛЯ", "uk"), { type: "pause" });
  assert.deepEqual(parseBuildVoiceCommand("блять", "uk"), { type: "pause" });
  assert.deepEqual(parseBuildVoiceCommand("ну блин", "uk"), { type: "pause" });
  assert.deepEqual(parseBuildVoiceCommand("бляха муха", "uk"), { type: "pause" });
  assert.deepEqual(parseBuildVoiceCommand("Я потерялся", "uk"), { type: "lost" });
  assert.deepEqual(parseBuildVoiceCommand("Вимкни звук", "uk"), { type: "voice_off" });
});

test("parses English build commands", () => {
  assert.deepEqual(parseBuildVoiceCommand("please continue", "en"), { type: "play" });
  assert.deepEqual(parseBuildVoiceCommand("next step", "en"), { type: "next" });
  assert.deepEqual(parseBuildVoiceCommand("slow down", "en"), { type: "slower" });
  assert.deepEqual(parseBuildVoiceCommand("turn on sound", "en"), { type: "voice_on" });
});

test("parses an explicit step and ignores unrelated speech", () => {
  assert.deepEqual(parseBuildVoiceCommand("Перейти до кроку 1250", "uk"), {
    type: "seek",
    step: 1250,
  });
  assert.deepEqual(parseBuildVoiceCommand("go to step 87", "en"), {
    type: "seek",
    step: 87,
  });
  assert.equal(parseBuildVoiceCommand("beautiful picture", "en"), null);
});
