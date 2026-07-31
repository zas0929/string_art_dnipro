"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import Ban from "lucide-react/dist/esm/icons/ban.mjs";
import Printer from "lucide-react/dist/esm/icons/printer.mjs";
import QrCode from "lucide-react/dist/esm/icons/qr-code.mjs";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PRINT_SETTINGS,
  createInstructionPages,
} from "../../core/print-instruction.js";
import { loadLatestPattern } from "../../storage/local-project-store.js";
import { getProjectStore } from "../../storage/project-store.js";
import {
  createSharedPatternUrl,
  loadOwnedShare,
  publishSharedPattern,
  revokeSharedPattern,
} from "../../storage/shared-pattern-store.js";
import LanguageSwitch from "../i18n/LanguageSwitch.jsx";
import { useLanguage } from "../i18n/LanguageProvider.jsx";

const COVER_COPY = {
  uk: {
    title: "Інструкція",
    stickerStep: "Наклейте наліпки з цифрами навколо цвяхів по порядку. Починати можна з будь-якої точки.",
    tieStep: "Знайдіть на дошці цвях під номером 1 та зав’яжіть нитку навколо нього на 3–5 вузликів.",
    buildStep: "Тепер крок за кроком збирайте свою картину за таблицею.",
    note: "Насолоджуйтесь процесом, він займе приблизно 6–9 годин.",
    instagram: "Наш Instagram:",
    scanQr: "Відскануйте QR-код, щоб відкрити голосовий режим складання:",
    step: "крок",
  },
  en: {
    title: "Instructions",
    stickerStep: "Place the numbered stickers around the nails in order. You may start from any point.",
    tieStep: "Find nail number 1 on the board and tie the thread around it with 3–5 knots.",
    buildStep: "Now follow the table step by step to create your picture.",
    note: "Enjoy the process. It takes approximately 6–9 hours.",
    instagram: "Our Instagram:",
    scanQr: "Scan the QR code to open the voice-guided Build Mode:",
    step: "step",
  },
};

export default function PrintInstruction() {
  const { language: uiLanguage, t } = useLanguage();
  const [pattern, setPattern] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coverImage, setCoverImage] = useState("artwork");
  const [language, setLanguage] = useState("en");
  const [includeStickerStep, setIncludeStickerStep] = useState(true);
  const [stripedRows, setStripedRows] = useState(false);
  const [startStep, setStartStep] = useState(DEFAULT_PRINT_SETTINGS.startStep);
  const [endStep, setEndStep] = useState(DEFAULT_PRINT_SETTINGS.endStep);
  const [rowsPerColumn, setRowsPerColumn] = useState(DEFAULT_PRINT_SETTINGS.rowsPerColumn);
  const [includeBuildQr, setIncludeBuildQr] = useState(true);
  const [sharedPattern, setSharedPattern] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    let active = true;
    loadLatestPattern()
      .then((savedPattern) => {
        if (!active) return;
        setPattern(savedPattern);
        setEndStep(savedPattern
          ? Math.min(savedPattern.lineCount, DEFAULT_PRINT_SETTINGS.endStep)
          : DEFAULT_PRINT_SETTINGS.endStep);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setLanguage(uiLanguage);
  }, [uiLanguage]);

  useEffect(() => {
    if (!pattern?.id) return undefined;
    let active = true;
    loadOwnedShare(pattern.id)
      .then((share) => {
        if (!active || !share) return;
        setSharedPattern({
          ...share,
          url: createSharedPatternUrl(share.token, window.location.origin),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pattern?.id]);

  useEffect(() => {
    let active = true;
    const shareUrl = sharedPattern?.active ? sharedPattern.url : "";
    if (!shareUrl) {
      setQrCodeDataUrl("");
      return undefined;
    }
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(shareUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 512,
        color: { dark: "#111111", light: "#ffffff" },
      }))
      .then((dataUrl) => {
        if (active) setQrCodeDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setShareMessage(t("print.qrRenderError"));
      });
    return () => {
      active = false;
    };
  }, [sharedPattern?.active, sharedPattern?.url]);

  const pages = useMemo(
    () => createInstructionPages(pattern?.sequence, {
      startStep,
      endStep,
      rowsPerColumn,
      columnsPerPage: 4,
    }),
    [pattern, startStep, endStep, rowsPerColumn],
  );
  const coverPreview = coverImage === "source"
    ? pattern?.sourcePreviewDataUrl
    : pattern?.artworkPreviewDataUrl;
  const printableLineCount = pages.reduce(
    (pageTotal, page) => pageTotal + page.reduce(
      (columnTotal, column) => columnTotal + column.length,
      0,
    ),
    0,
  );

  const printDocument = (target) => {
    const className = `print-${target}-only`;
    const cleanup = () => document.body.classList.remove(className);
    document.body.classList.add(className);
    window.addEventListener("afterprint", cleanup, { once: true });
    requestAnimationFrame(() => window.print());
  };

  const createBuyerQr = async () => {
    setShareBusy(true);
    setShareMessage("");
    try {
      const store = await getProjectStore();
      const account = await store.getAccount();
      if (account.mode !== "cloud") throw new Error(t("print.qrLoginRequired"));
      const saved = await store.saveLatestPattern(pattern);
      const savedPattern = saved.pattern || pattern;
      const token = await publishSharedPattern(savedPattern.id);
      const share = {
        token,
        active: true,
        url: createSharedPatternUrl(token, window.location.origin),
      };
      setPattern(savedPattern);
      setSharedPattern(share);
      setIncludeBuildQr(true);
      setShareMessage(t("print.qrReady"));
    } catch (error) {
      setShareMessage(error?.message || t("print.qrCreateError"));
    } finally {
      setShareBusy(false);
    }
  };

  const disableBuyerQr = async () => {
    if (!pattern?.id) return;
    setShareBusy(true);
    setShareMessage("");
    try {
      await revokeSharedPattern(pattern.id);
      setSharedPattern((current) => current ? { ...current, active: false } : null);
      setShareMessage(t("print.qrDisabled"));
    } catch (error) {
      setShareMessage(error?.message || t("print.qrDisableError"));
    } finally {
      setShareBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="print-loading">
        <LanguageSwitch />
        <span>{t("print.preparing")}</span>
      </main>
    );
  }

  if (!pattern) {
    return (
      <main className="print-empty">
        <LanguageSwitch />
        <h1>{t("print.noPattern")}</h1>
        <p>{t("print.noPatternHint")}</p>
        <a className="command-link" href="/create">
          <ArrowLeft aria-hidden="true" size={18} />
          {t("print.back")}
        </a>
      </main>
    );
  }

  return (
    <main className="print-page">
      <LanguageSwitch />
      <header className="print-toolbar">
        <div className="print-toolbar-title">
          <a className="back-link" href="/create">
            <ArrowLeft aria-hidden="true" size={18} />
            {t("common.generator")}
          </a>
          <h1>{t("print.title")}</h1>
          <p>{t("print.summary", { pins: pattern.pointCount, lines: printableLineCount })}</p>
        </div>

        <div className="print-settings">
          <fieldset className="print-settings-group">
            <legend>{t("print.cover")}</legend>
            <div className="print-settings-grid cover-settings-grid">
              <label>
                {t("print.instructionLanguage")}
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="uk">Українська</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                {t("print.preview")}
                <select
                  value={coverImage}
                  onChange={(event) => setCoverImage(event.target.value)}
                >
                  <option value="artwork">{t("print.artworkPreview")}</option>
                  <option value="source" disabled={!pattern.sourcePreviewDataUrl}>{t("print.sourcePhoto")}</option>
                  <option value="none">{t("print.noImage")}</option>
                </select>
              </label>
              <label className="print-check">
                <input
                  type="checkbox"
                  checked={includeStickerStep}
                  onChange={(event) => setIncludeStickerStep(event.target.checked)}
                />
                {t("print.includeSticker")}
              </label>
            </div>
          </fieldset>

          <fieldset className="print-settings-group">
            <legend>{t("print.stepTable")}</legend>
            <div className="print-settings-grid instruction-settings-grid">
              <label>
                {t("print.startStep")}
                <input
                  type="number"
                  min="1"
                  max={pattern.lineCount}
                  value={startStep}
                  onChange={(event) => setStartStep(event.target.value)}
                />
              </label>
              <label>
                {t("print.endStep")}
                <input
                  type="number"
                  min="1"
                  max={pattern.lineCount}
                  value={endStep}
                  onChange={(event) => setEndStep(event.target.value)}
                />
              </label>
              <label>
                {t("print.rowsPerColumn")}
                <input
                  type="number"
                  min="20"
                  max="70"
                  value={rowsPerColumn}
                  onChange={(event) => setRowsPerColumn(event.target.value)}
                />
              </label>
              <label className="print-check">
                <input
                  type="checkbox"
                  checked={stripedRows}
                  onChange={(event) => setStripedRows(event.target.checked)}
                />
                {t("print.stripedRows")}
              </label>
            </div>
          </fieldset>

          <fieldset className="print-settings-group qr-settings-group">
            <legend>{t("print.buyerQr")}</legend>
            <div className="qr-settings-grid">
              <label className="print-check">
                <input
                  type="checkbox"
                  checked={includeBuildQr}
                  disabled={!sharedPattern?.active}
                  onChange={(event) => setIncludeBuildQr(event.target.checked)}
                />
                {t("print.includeBuyerQr")}
              </label>
              <button type="button" disabled={shareBusy} onClick={createBuyerQr}>
                <QrCode aria-hidden="true" size={18} />
                {shareBusy
                  ? t("print.qrWorking")
                  : sharedPattern?.active
                    ? t("print.refreshBuyerQr")
                    : t("print.createBuyerQr")}
              </button>
              {sharedPattern?.active && (
                <button type="button" disabled={shareBusy} onClick={disableBuyerQr}>
                  <Ban aria-hidden="true" size={18} />
                  {t("print.disableBuyerQr")}
                </button>
              )}
            </div>
            {shareMessage && <p className="qr-settings-message" role="status">{shareMessage}</p>}
          </fieldset>
        </div>

        <div className="print-actions">
          <button className="print-action secondary-print-action" type="button" onClick={() => printDocument("cover")}>
            <Printer aria-hidden="true" size={19} />
            {t("print.coverPdf")}
          </button>
          <button className="print-action" type="button" onClick={() => printDocument("instruction")}>
            <Printer aria-hidden="true" size={19} />
            {t("print.instructionsPdf")}
          </button>
        </div>
      </header>

      <div className="print-preview">
        <section className="print-document-section cover-document">
          <div className="print-document-heading">
            <h2>{t("print.coverPage")}</h2>
            <span>{t("print.separateDocument")}</span>
          </div>
          <CoverSheet
            image={coverImage === "none" ? null : coverPreview}
            language={language}
            includeStickerStep={includeStickerStep}
            buildQrCode={includeBuildQr ? qrCodeDataUrl : ""}
          />
        </section>

        <section className="print-document-section instruction-document">
          <div className="print-document-heading">
            <div>
              <h2>{t("print.stepTable")}</h2>
              <p>{t("print.duplexHint")}</p>
            </div>
            <span>{t("print.pages", { count: pages.length })}</span>
          </div>
          <div className="instruction-pages">
            {pages.map((pageColumns, pageIndex) => (
              <InstructionSheet
                key={`${startStep}-${endStep}-${rowsPerColumn}-${pageIndex}`}
                columns={pageColumns}
                stripedRows={stripedRows}
                language={language}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function CoverSheet({ image, language, includeStickerStep, buildQrCode }) {
  const copy = COVER_COPY[language] || COVER_COPY.en;
  const steps = [
    includeStickerStep ? copy.stickerStep : null,
    copy.tieStep,
    copy.buildStep,
  ].filter(Boolean);

  return (
    <section className="print-sheet cover-sheet">
      <div className={`cover-image${image ? "" : " is-empty"}`}>
        {image && <img src={image} alt="String Art preview" />}
      </div>
      <h2>{copy.title}</h2>
      <ol>
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="cover-note">{copy.note}</p>
      <footer className={`cover-footer${buildQrCode ? " has-build-qr" : ""}`}>
        <div className="cover-brand">
          <span>{copy.instagram}</span>
          <img src="/instagram-qr.png" alt="@STRING_ART_DNIPRO" />
        </div>
        {buildQrCode && (
          <div className="cover-build-qr">
            <span>{copy.scanQr}</span>
            <img src={buildQrCode} alt="Build Mode QR code" />
          </div>
        )}
      </footer>
    </section>
  );
}

function InstructionSheet({ columns, stripedRows, language }) {
  const stepLabel = (COVER_COPY[language] || COVER_COPY.en).step;

  return (
    <section className="print-sheet instruction-sheet">
      <div className="instruction-columns">
        {columns.map((rows, columnIndex) => (
          <div className="instruction-column" key={columnIndex}>
            {rows.map(({ step, point }, rowIndex) => (
              <div
                className={`instruction-row${
                  stripedRows && Math.floor(rowIndex / 2) % 2 === 1 ? " is-striped" : ""
                }`}
                key={step}
              >
                <span>{step} {stepLabel} - <strong>{point}</strong></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
