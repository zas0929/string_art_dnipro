const APP_SCHEME = "stringartdnipro:";
const APP_HOSTS = new Set(["stringartdnipro.com", "www.stringartdnipro.com"]);

export function getMobileAppDestination(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);

    if (url.protocol === "https:" && APP_HOSTS.has(url.hostname)) {
      return `${url.pathname || "/create"}${url.search}${url.hash}`;
    }

    if (url.protocol === APP_SCHEME) {
      const host = url.hostname ? `/${url.hostname}` : "";
      const pathname = url.pathname === "/" ? "" : url.pathname;
      return `${host}${pathname}${url.search}${url.hash}` || "/create";
    }
  } catch {
    return null;
  }

  return null;
}
