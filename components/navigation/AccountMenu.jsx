"use client";

import ChevronDown from "lucide-react/dist/esm/icons/chevron-down.mjs";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import LogOut from "lucide-react/dist/esm/icons/log-out.mjs";
import UserRound from "lucide-react/dist/esm/icons/user-round.mjs";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "../../app/login/actions.js";
import { useAuthSession } from "../auth/AuthSessionProvider.jsx";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

export default function AccountMenu({ className = "", tone = "dark" }) {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const classes = `account-menu account-menu--${tone}${className ? ` ${className}` : ""}`;

  return (
    <div className={classes} ref={rootRef}>
      <button
        className="account-menu-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-menu-avatar" aria-hidden="true">
          <UserRound size={16} />
          {user ? <span /> : null}
        </span>
        <span className="account-menu-email">{user?.email || t("auth.account")}</span>
        <ChevronDown aria-hidden="true" className={open ? "is-open" : ""} size={15} />
      </button>

      {open ? (
        <div className="account-menu-popover" id={menuId}>
          <div className={`account-menu-identity${user ? "" : " is-guest"}`}>
            <span>{user ? t("common.signedIn") : t("auth.account")}</span>
            {user ? (
              <strong title={user.email}>{user.email}</strong>
            ) : (
              <p>{t("auth.accountHint")}</p>
            )}
          </div>
          <div className="account-menu-language">
            <span>{t("common.language")}</span>
            <LanguageSwitch />
          </div>
          <a href="/projects">
            <FolderOpen aria-hidden="true" size={18} />
            {t("landing.projects")}
          </a>
          {user ? (
            <form action={signOut}>
              <button type="submit">
                <LogOut aria-hidden="true" size={18} />
                {t("auth.signOut")}
              </button>
            </form>
          ) : (
            <a href="/login">
              <LogIn aria-hidden="true" size={18} />
              {t("auth.signInOrCreate")}
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}
