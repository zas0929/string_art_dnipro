"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import KeyRound from "lucide-react/dist/esm/icons/key-round.mjs";
import { useActionState } from "react";
import { updatePassword } from "../../app/reset-password/actions.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const INITIAL_STATE = { error: "" };

export default function ResetPasswordForm({ configured }) {
  const { t } = useLanguage();
  const [state, action, pending] = useActionState(updatePassword, INITIAL_STATE);

  return (
    <section className="auth-shell">
      <a className="back-link" href="/login">
        <ArrowLeft aria-hidden="true" size={18} />
        {t("auth.backToSignIn")}
      </a>
      <div className="auth-heading">
        <p>String Art Generator</p>
        <h1>{t("auth.newPasswordTitle")}</h1>
        <span>{t("auth.newPasswordSubtitle")}</span>
      </div>
      <form className="auth-form" action={action}>
        <label>
          {t("auth.newPassword")}
          <input
            name="password"
            type="password"
            minLength="8"
            autoComplete="new-password"
            required
            disabled={!configured || pending}
          />
        </label>
        <label>
          {t("auth.confirmPassword")}
          <input
            name="passwordConfirmation"
            type="password"
            minLength="8"
            autoComplete="new-password"
            required
            disabled={!configured || pending}
          />
        </label>
        <button className="auth-submit" type="submit" disabled={!configured || pending}>
          <KeyRound aria-hidden="true" size={18} />
          {pending ? t("auth.working") : t("auth.updatePassword")}
        </button>
      </form>
      {!configured && <p className="auth-message is-warning">{t("auth.notConfigured")}</p>}
      {state.error && <p className="auth-message is-error" role="alert">{t(`auth.${state.error}`)}</p>}
    </section>
  );
}
