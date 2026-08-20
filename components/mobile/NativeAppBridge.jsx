"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { getMobileAppDestination } from "../../core/mobile-link.js";

export default function NativeAppBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let disposed = false;
    let listenerHandle;

    document.documentElement.dataset.nativeApp = "true";

    const keepInsideWorkspace = () => {
      if (window.location.pathname === "/") {
        window.location.replace(`/create${window.location.search}${window.location.hash}`);
      }
    };

    const handleDocumentClick = (event) => {
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname !== "/") return;

      event.preventDefault();
      window.location.assign(`/create${destination.search}${destination.hash}`);
    };

    const openAppUrl = ({ url }) => {
      const destination = getMobileAppDestination(url);
      if (!destination) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (destination !== current) window.location.assign(destination);
    };

    void App.addListener("appUrlOpen", openAppUrl).then((handle) => {
      if (disposed) {
        void handle.remove();
        return;
      }
      listenerHandle = handle;
    });

    void App.getLaunchUrl().then((launch) => {
      if (!disposed && launch?.url) openAppUrl(launch);
    });

    keepInsideWorkspace();
    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", keepInsideWorkspace);

    return () => {
      disposed = true;
      delete document.documentElement.dataset.nativeApp;
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", keepInsideWorkspace);
      void listenerHandle?.remove();
    };
  }, []);

  return null;
}
