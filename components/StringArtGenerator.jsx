"use client";

import { useRef } from "react";
import StringArtPanel from "./StringArtPanel.jsx";
import StringArtWorkspace from "./StringArtWorkspace.jsx";
import { useStringArtController } from "./useStringArtController.js";
import LanguageSwitch from "./i18n/LanguageSwitch.jsx";

export default function StringArtGenerator() {
  const appRef = useRef(null);
  useStringArtController(appRef);

  return (
    <main ref={appRef} className="app">
      <LanguageSwitch />
      <StringArtWorkspace />
      <StringArtPanel />
    </main>
  );
}
