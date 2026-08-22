import test from "node:test";
import assert from "node:assert/strict";
import {
  NATIVE_AUTH_CALLBACK_URL,
  parseNativeAuthCallback,
} from "../core/native-auth.js";

test("native auth callback exposes an OAuth authorization code", () => {
  assert.equal(NATIVE_AUTH_CALLBACK_URL, "stringartdnipro://auth/confirm");
  assert.deepEqual(
    parseNativeAuthCallback("stringartdnipro://auth/confirm?code=oauth-code"),
    {
      code: "oauth-code",
      accessToken: "",
      refreshToken: "",
      error: "",
    },
  );
});

test("native auth callback supports an implicit token response", () => {
  assert.deepEqual(
    parseNativeAuthCallback(
      "stringartdnipro://auth/confirm#access_token=access&refresh_token=refresh",
    ),
    {
      code: "",
      accessToken: "access",
      refreshToken: "refresh",
      error: "",
    },
  );
});

test("native auth callback rejects unrelated links and exposes provider errors", () => {
  assert.equal(parseNativeAuthCallback("https://stringartdnipro.com/auth/confirm?code=x"), null);
  assert.equal(parseNativeAuthCallback("stringartdnipro://create"), null);
  assert.equal(parseNativeAuthCallback("not a URL"), null);
  assert.equal(
    parseNativeAuthCallback(
      "stringartdnipro://auth/confirm?error=access_denied&error_description=Cancelled",
    ).error,
    "Cancelled",
  );
});
