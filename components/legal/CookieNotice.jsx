"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const STORAGE_KEY = "string-art-cookie-choice-v1";
const text = {
  uk: {
    title: "Ми використовуємо cookies",
    body: "Ми використовуємо cookies для роботи сайту. Ви можете прийняти всі cookies або налаштувати свої вподобання.",
    accept: "Прийняти всі", reject: "Відхилити необов’язкові", preferences: "Налаштування cookies",
    necessary: "Необхідні — завжди активні", detail: "Забезпечують вхід та основні функції сайту. Необов’язкові cookies наразі не використовуються.",
    save: "Зберегти налаштування", back: "Назад", policy: "Політика cookies",
  },
  en: {
    title: "We use cookies",
    body: "We use cookies to make this site work. You can accept all cookies or manage your preferences.",
    accept: "Accept all", reject: "Reject optional", preferences: "Cookie settings",
    necessary: "Necessary — always active", detail: "These support sign-in and core site features. Optional cookies are not currently used.",
    save: "Save preferences", back: "Back", policy: "Cookie Policy",
  },
};

export default function CookieNotice() {
  const { language } = useLanguage();
  const copy = text[language] || text.uk;
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState(false);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
      setOpen(!saved || !["accepted", "necessary"].includes(saved.choice));
    } catch { setOpen(true); }
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (preferences && open && dialog && !dialog.open) dialog.showModal();
    else if (dialog?.open) dialog.close();
  }, [preferences, open]);

  function save(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, updatedAt: new Date().toISOString() }));
    } catch { /* Keep the notice usable when browser storage is unavailable. */ }
    setOpen(false);
    setPreferences(false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  return (
    <>
      <button ref={triggerRef} className="cookie-settings-link" type="button" aria-expanded={open} aria-controls="cookie-notice" onClick={() => { setPreferences(true); setOpen(true); }}>{copy.preferences}</button>
      {open && !preferences && (
        <section id="cookie-notice" className="cookie-notice" aria-labelledby="cookie-notice-title">
          <h2 id="cookie-notice-title">{preferences ? copy.preferences : copy.title}</h2>
          <p>{copy.body}</p>
          <div className="cookie-notice-actions">
            <button type="button" onClick={() => save("accepted")}>{copy.accept}</button>
            <button type="button" onClick={() => save("necessary")}>{copy.reject}</button>
            <button type="button" onClick={() => setPreferences(true)}>{copy.preferences}</button>
          </div>
          <a href="/cookie-policy">{copy.policy}</a>
        </section>
      )}
      <dialog
        ref={dialogRef}
        className="cookie-preferences-dialog"
        aria-labelledby="cookie-preferences-title"
        onCancel={() => setPreferences(false)}
        onClose={() => setPreferences(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setPreferences(false);
        }}
      >
        <header className="cookie-preferences-header">
          <h2 id="cookie-preferences-title">{copy.preferences}</h2>
          <button type="button" aria-label={language === "uk" ? "Закрити" : "Close"} onClick={() => setPreferences(false)}>×</button>
        </header>
        <div className="cookie-preferences-content">
          <p>{copy.body}</p>
          <details className="cookie-category">
            <summary><span>{language === "uk" ? "Необхідні cookies" : "Necessary cookies"}</span><span className="cookie-category-status">{language === "uk" ? "Завжди активні" : "Always enabled"}</span></summary>
            <p>{copy.detail}</p>
          </details>
          <details className="cookie-category">
            <summary><span>{language === "uk" ? "Аналітичні cookies" : "Analytics cookies"}</span><span className="cookie-category-status">{language === "uk" ? "Не підключені" : "Not connected"}</span></summary>
            <p>{language === "uk" ? "Сторонні сервіси аналітики не підключені. Аналітичні cookies не встановлюються." : "No third-party analytics services are connected. Analytics cookies are not set."}</p>
          </details>
          <p className="cookie-preferences-info"><a href="/cookie-policy">{copy.policy}</a> · <a href="https://www.instagram.com/string_art_dnipro/" target="_blank" rel="noopener noreferrer">{language === "uk" ? "Зв’язатися з нами" : "Contact us"}</a></p>
        </div>
        <footer className="cookie-preferences-actions">
          <button type="button" onClick={() => save("accepted")}>{copy.accept}</button>
          <button type="button" onClick={() => save("necessary")}>{copy.reject}</button>
          <button type="button" onClick={() => save("necessary")}>{copy.save}</button>
        </footer>
      </dialog>
    </>
  );
}
