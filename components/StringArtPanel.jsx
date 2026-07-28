"use client";

import FileImage from "lucide-react/dist/esm/icons/file-image.mjs";
import FileText from "lucide-react/dist/esm/icons/file-text.mjs";
import FolderOpen from "lucide-react/dist/esm/icons/folder-open.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";
import LogIn from "lucide-react/dist/esm/icons/log-in.mjs";
import Printer from "lucide-react/dist/esm/icons/printer.mjs";
import Save from "lucide-react/dist/esm/icons/save.mjs";
import { useLanguage } from "./i18n/LanguageProvider.jsx";

export default function StringArtPanel() {
  const { t } = useLanguage();

  return (
    <aside className="panel">
      <div className="control-group">
        <h2>{t("panel.settings")}</h2>
        <label>
          {t("panel.pins")}
          <input id="pointsInput" type="number" min="60" max="600" step="10" defaultValue="240" />
        </label>
        <input id="linesInput" type="hidden" defaultValue="5000" />
        <label>
          {t("panel.artworkSize")}
          <input id="sizeInput" type="number" min="10" max="200" step="1" defaultValue="47" />
        </label>
        <label>
          {t("panel.threadThickness")}
          <select id="threadInput" defaultValue="0.19">
            <option value="0.11">0.11 - {t("panel.thin")}</option>
            <option value="0.16">0.16 - {t("panel.medium")}</option>
            <option value="0.19">0.19 - {t("panel.standard")}</option>
            <option value="0.22">0.22 - {t("panel.thick")}</option>
            <option value="0.27">0.27 - {t("panel.extraThick")}</option>
            <option value="0.3">0.30 - {t("panel.maximum")}</option>
          </select>
        </label>
        <label>
          {t("panel.minimumGap")}
          <input id="skipInput" type="number" min="2" max="80" step="1" defaultValue="15" />
        </label>
      </div>

      <div className="actions">
        <button id="pngButton" type="button" disabled>
          <FileImage aria-hidden="true" size={17} strokeWidth={2} />
          PNG
        </button>
        <button id="txtButton" type="button" disabled>
          <FileText aria-hidden="true" size={17} strokeWidth={2} />
          TXT
        </button>
        <button id="printButton" type="button" disabled>
          <Printer aria-hidden="true" size={17} strokeWidth={2} />
          {t("panel.print")}
        </button>
      </div>

      <button id="saveProjectButton" className="command-link" type="button" disabled>
        <Save aria-hidden="true" size={18} strokeWidth={2} />
        <span id="saveProjectLabel">{t("panel.saveProject")}</span>
      </button>

      <a id="buildModeLink" className="command-link" href="/build">
        <ListChecks aria-hidden="true" size={18} strokeWidth={2} />
        {t("panel.buildMode")}
      </a>

      <a className="command-link" href="/projects">
        <FolderOpen aria-hidden="true" size={18} strokeWidth={2} />
        {t("panel.myProjects")}
      </a>

      <a className="command-link" href="/account">
        <LogIn aria-hidden="true" size={18} strokeWidth={2} />
        {t("panel.account")}
      </a>

      <div className="summary">
        <h2>{t("panel.details")}</h2>
        <dl>
          <div><dt>{t("panel.pins")}</dt><dd id="pointsOut">-</dd></div>
          <div><dt>{t("panel.lines")}</dt><dd id="linesOut">-</dd></div>
          <div><dt>{t("panel.step")}</dt><dd id="stepOut">-</dd></div>
          <div><dt>{t("panel.threadLength")}</dt><dd id="lengthOut">-</dd></div>
        </dl>
        <textarea
          id="sequenceOutput"
          readOnly
          spellCheck="false"
          placeholder={t("panel.sequencePlaceholder")}
          aria-label={t("panel.sequenceLabel")}
        />
      </div>
    </aside>
  );
}
