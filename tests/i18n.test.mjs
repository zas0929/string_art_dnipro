import assert from "node:assert/strict";
import test from "node:test";

import { normalizeLanguage, translate } from "../core/i18n.js";

test("translates UI copy and interpolates dynamic values", () => {
  assert.equal(
    translate("uk", "build.stepOf", { current: 12, total: 4500 }),
    "Крок 12 з 4500",
  );
  assert.equal(
    translate("en", "generator.generated", { completed: 400, total: 5000 }),
    "Generated lines: 400 / 5000",
  );
});

test("uses Ukrainian by default for unsupported languages", () => {
  assert.equal(normalizeLanguage("de"), "uk");
  assert.equal(translate("de", "panel.settings"), "Налаштування");
});
