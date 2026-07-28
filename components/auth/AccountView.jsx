"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import LogOut from "lucide-react/dist/esm/icons/log-out.mjs";
import { signOut } from "../../app/login/actions.js";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function AccountView({ email }) {
  const { t } = useLanguage();

  return (
    <section className="auth-shell account-shell">
      <a className="back-link" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        {t("common.generator")}
      </a>
      <div className="auth-heading">
        <p>String Art Generator</p>
        <h1>{t("auth.account")}</h1>
        <span>{email || t("auth.accountHint")}</span>
      </div>
      {email ? (
        <form action={signOut}>
          <button className="auth-submit account-action" type="submit">
            <LogOut aria-hidden="true" size={18} />
            {t("auth.signOut")}
          </button>
        </form>
      ) : (
        <a className="command-link account-action" href="/login">
          <LogIn aria-hidden="true" size={18} />
          {t("auth.signInOrCreate")}
        </a>
      )}
    </section>
  );
}
