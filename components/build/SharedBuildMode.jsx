"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import { useEffect, useState } from "react";
import { loadPublicSharedPattern } from "../../storage/shared-pattern-store.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import BuildMode from "./BuildMode.jsx";

export default function SharedBuildMode({ token }) {
  const { t } = useLanguage();
  const [pattern, setPattern] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    loadPublicSharedPattern(token)
      .then((sharedPattern) => {
        if (!active) return;
        if (!sharedPattern) {
          setStatus("not-found");
          return;
        }
        setPattern(sharedPattern);
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (status === "ready" && pattern) {
    return <BuildMode sharedPattern={pattern} />;
  }

  if (status === "loading") {
    return (
      <main className="build-loading">
        <LanguageSwitch />
        <span>{t("build.sharedLoading")}</span>
      </main>
    );
  }

  return (
    <main className="build-loading shared-build-error">
      <LanguageSwitch />
      <strong>{status === "not-found"
        ? t("build.sharedNotFound")
        : t("build.sharedError")}</strong>
      <a className="command-link" href="/create">
        <ArrowLeft aria-hidden="true" size={18} />
        {t("build.sharedBack")}
      </a>
    </main>
  );
}
