import assert from "node:assert/strict";
import test from "node:test";

import { formatTelegramOrder, normalizeOrderRequest } from "../core/order-request.js";

test("normalizes a valid order request", () => {
  const result = normalizeOrderRequest({
    phone: " +380 67 123 45 67 ",
    contactViaMessengers: true,
    selfGeneratePattern: false,
    language: "uk",
    source: "landing-order-modal",
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value, {
    phone: "+380 67 123 45 67",
    contactViaMessengers: true,
    selfGeneratePattern: false,
    language: "uk",
    source: "landing-order-modal",
    website: "",
  });
});

test("rejects invalid phone numbers", () => {
  assert.deepEqual(normalizeOrderRequest({ phone: "123" }), {
    valid: false,
    error: "invalidPhone",
  });
});

test("formats the Telegram notification without markup", () => {
  const message = formatTelegramOrder({
    phone: "+380 67 123 45 67",
    contactViaMessengers: true,
    selfGeneratePattern: true,
    language: "en",
    source: "landing-order-modal",
  });

  assert.match(message, /Нова заявка/);
  assert.match(message, /\+380 67 123 45 67/);
  assert.match(message, /створити макет самостійно/);
});
