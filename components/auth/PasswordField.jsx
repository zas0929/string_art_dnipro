"use client";

import Eye from "lucide-react/dist/esm/icons/eye.mjs";
import EyeOff from "lucide-react/dist/esm/icons/eye-off.mjs";
import { useState } from "react";

export default function PasswordField({
  label,
  showLabel,
  hideLabel,
  id,
  name,
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const inputId = id || name;
  const toggleLabel = visible ? hideLabel : showLabel;

  return (
    <div className="auth-form-field">
      <label htmlFor={inputId}>{label}</label>
      <div className="auth-password-field">
        <input
          {...inputProps}
          id={inputId}
          name={name}
          type={visible ? "text" : "password"}
        />
        <button
          className="auth-password-toggle"
          type="button"
          aria-label={toggleLabel}
          aria-pressed={visible}
          title={toggleLabel}
          onClick={() => setVisible((current) => !current)}
        >
          {visible
            ? <EyeOff aria-hidden="true" size={20} />
            : <Eye aria-hidden="true" size={20} />}
        </button>
      </div>
    </div>
  );
}
