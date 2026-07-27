"use client";

import { useLanguage } from "./LanguageProvider.jsx";

export default function LanguageSwitch({ className = "" }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`language-switch ${className}`.trim()} aria-label="Language">
      {["en", "uk"].map((option) => (
        <button
          key={option}
          type="button"
          className={language === option ? "is-active" : ""}
          aria-pressed={language === option}
          aria-label={option === "uk"
            ? t("common.switchToUkrainian")
            : t("common.switchToEnglish")}
          onClick={() => setLanguage(option)}
        >
          {t(`common.${option}`)}
        </button>
      ))}
    </div>
  );
}
