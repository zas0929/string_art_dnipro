import assert from "node:assert/strict";
import test from "node:test";
import { getMobileAppDestination } from "../core/mobile-link.js";

test("maps first-party shared pattern URLs to an internal route", () => {
  assert.equal(
    getMobileAppDestination("https://stringartdnipro.com/s/buyer-token?step=25#canvas"),
    "/s/buyer-token?step=25#canvas",
  );
});

test("maps custom-scheme routes to an internal route", () => {
  assert.equal(
    getMobileAppDestination("stringartdnipro://auth/confirm?code=abc"),
    "/auth/confirm?code=abc",
  );
  assert.equal(getMobileAppDestination("stringartdnipro://create"), "/create");
});

test("rejects external and malformed URLs", () => {
  assert.equal(getMobileAppDestination("https://example.com/s/private"), null);
  assert.equal(getMobileAppDestination("not a URL"), null);
  assert.equal(getMobileAppDestination(""), null);
});
