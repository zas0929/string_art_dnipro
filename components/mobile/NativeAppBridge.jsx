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

    return () => {
      disposed = true;
      void listenerHandle?.remove();
    };
  }, []);

  return null;
}
