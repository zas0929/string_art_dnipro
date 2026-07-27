"use client";

import { useEffect } from "react";
import { mountStringArtApp } from "../app.js";

export function useStringArtController(rootRef) {
  useEffect(() => {
    let cleanup = null;
    const root = rootRef.current;

    try {
      cleanup = mountStringArtApp(root);
      root.dataset.controllerReady = "true";
    } catch (error) {
      const status = root?.querySelector("#status");
      if (status) status.textContent = `Startup error: ${error.message}`;
    }

    return () => {
      if (root) delete root.dataset.controllerReady;
      if (cleanup) cleanup();
    };
  }, [rootRef]);
}
