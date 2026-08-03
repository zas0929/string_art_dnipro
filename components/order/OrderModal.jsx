"use client";

import ArrowRight from "lucide-react/dist/esm/icons/arrow-right.mjs";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2.mjs";
import MessageCircle from "lucide-react/dist/esm/icons/message-circle.mjs";
import Phone from "lucide-react/dist/esm/icons/phone.mjs";
import X from "lucide-react/dist/esm/icons/x.mjs";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function OrderModal({ open, onClose }) {
  const { language, t } = useLanguage();
  const phoneInputRef = useRef(null);
  const [phone, setPhone] = useState("");
  const [contactViaMessengers, setContactViaMessengers] = useState(true);
  const [selfGeneratePattern, setSelfGeneratePattern] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimeout = window.setTimeout(() => phoneInputRef.current?.focus(), 80);
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimeout);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const submitOrder = async (event) => {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          contactViaMessengers,
          selfGeneratePattern,
          language,
          source: "landing-order-modal",
          website: formData.get("website"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "deliveryFailed");
      setStatus("success");
    } catch (requestError) {
      setStatus("error");
      const errorMessages = {
        invalidPhone: "order.invalidPhone",
        rateLimited: "order.rateLimited",
        notConfigured: "order.notConfigured",
        telegramUnauthorized: "order.telegramUnauthorized",
        telegramChatNotFound: "order.telegramChatNotFound",
        telegramThreadNotFound: "order.telegramThreadNotFound",
        telegramBlocked: "order.telegramBlocked",
      };
      setError(t(errorMessages[requestError.message] || "order.submitError"));
    }
  };

  return (
    <div className="order-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
        <button className="order-modal-close" type="button" onClick={onClose} aria-label={t("order.close")}>
          <X aria-hidden="true" size={20} />
        </button>

        {status === "success" ? (
          <div className="order-success">
            <CheckCircle2 aria-hidden="true" size={34} />
            <p className="landing-eyebrow">String Art Dnipro</p>
            <h2 id="order-modal-title">{t("order.successTitle")}</h2>
            <p>{t("order.successCopy")}</p>
            {selfGeneratePattern && (
              <a className="landing-primary-cta" href="/create">
                {t("order.openGenerator")}<ArrowRight aria-hidden="true" size={17} />
              </a>
            )}
            <button className="landing-secondary-cta" type="button" onClick={onClose}>{t("order.done")}</button>
          </div>
        ) : (
          <form className="order-form" onSubmit={submitOrder}>
            <p className="landing-eyebrow">String Art Dnipro</p>
            <h2 id="order-modal-title">{t("order.title")}</h2>
            <p className="order-intro">{t("order.copy")}</p>

            <label className="order-phone-field">
              <span><Phone aria-hidden="true" size={17} />{t("order.phone")}</span>
              <input
                ref={phoneInputRef}
                type="tel"
                name="phone"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+380 00 000 00 00"
                required
              />
            </label>

            <input className="order-honeypot" type="text" name="website" tabIndex="-1" autoComplete="off" aria-hidden="true" />

            <label className="order-checkbox">
              <input type="checkbox" checked={contactViaMessengers} onChange={(event) => setContactViaMessengers(event.target.checked)} />
              <span><MessageCircle aria-hidden="true" size={18} /><strong>{t("order.messengers")}</strong></span>
            </label>

            <label className="order-checkbox">
              <input type="checkbox" checked={selfGeneratePattern} onChange={(event) => setSelfGeneratePattern(event.target.checked)} />
              <span><strong>{t("order.selfGenerate")}</strong><small>{t("order.selfGenerateHint")}</small></span>
            </label>

            {!selfGeneratePattern && <p className="order-help-copy">{t("order.helpPattern")}</p>}
            {error && <p className="order-error" role="alert">{error}</p>}

            <button className="landing-primary-cta order-submit" type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? t("order.submitting") : t("order.submit")}
              <ArrowRight aria-hidden="true" size={17} />
            </button>
            <p className="order-privacy">{t("order.privacy")}</p>
          </form>
        )}
      </section>
    </div>
  );
}
