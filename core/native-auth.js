export const NATIVE_AUTH_CALLBACK_URL = "stringartdnipro://auth/confirm";

export function parseNativeAuthCallback(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "stringartdnipro:") return null;
    if (url.hostname !== "auth" || url.pathname !== "/confirm") return null;

    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    return {
      code: url.searchParams.get("code") || "",
      accessToken: hash.get("access_token") || "",
      refreshToken: hash.get("refresh_token") || "",
      error: url.searchParams.get("error_description")
        || url.searchParams.get("error")
        || hash.get("error_description")
        || hash.get("error")
        || "",
    };
  } catch {
    return null;
  }
}
