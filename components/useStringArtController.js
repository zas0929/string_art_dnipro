"use client";

import { useEffect } from "react";

export function useStringArtController(rootRef) {
  useEffect(() => {
    let active = true;
    let cleanup = null;

    import("../app.js")
      .then(({ mountStringArtApp }) => {
        if (!active || !rootRef.current) return;
        cleanup = mountStringArtApp(rootRef.current);
      })
      .catch((error) => {
        if (!active) return;
        const status = rootRef.current?.querySelector("#status");
        if (status) status.textContent = `Ошибка запуска: ${error.message}`;
      });

    return () => {
      active = false;
      if (cleanup) cleanup();
    };
  }, [rootRef]);
}
