"use client";

import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left.mjs";
import Printer from "lucide-react/dist/esm/icons/printer.mjs";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_PRINT_SETTINGS,
  createInstructionPages,
} from "../../core/print-instruction.js";
import { loadLatestPattern } from "../../storage/local-project-store.js";

const COVER_COPY = {
  uk: {
    title: "Інструкція",
    stickerStep: "Наклейте наліпки з цифрами навколо цвяхів по порядку. Починати можна з будь-якої точки.",
    tieStep: "Знайдіть на дошці цвях під номером 1 та зав’яжіть нитку навколо нього на 3–5 вузликів.",
    buildStep: "Тепер крок за кроком збирайте свою картину за таблицею.",
    note: "Насолоджуйтесь процесом, він займе приблизно 6–9 годин.",
    instagram: "Наш Instagram:",
    step: "крок",
  },
  en: {
    title: "Instructions",
    stickerStep: "Place the numbered stickers around the nails in order. You may start from any point.",
    tieStep: "Find nail number 1 on the board and tie the thread around it with 3–5 knots.",
    buildStep: "Now follow the table step by step to create your picture.",
    note: "Enjoy the process. It takes approximately 6–9 hours.",
    instagram: "Our Instagram:",
    step: "step",
  },
};

export default function PrintInstruction() {
  const [pattern, setPattern] = useState(null);
  const [loading, setLoading] = useState(true);
  const [coverImage, setCoverImage] = useState("artwork");
  const [language, setLanguage] = useState("uk");
  const [includeStickerStep, setIncludeStickerStep] = useState(true);
  const [stripedRows, setStripedRows] = useState(false);
  const [startStep, setStartStep] = useState(DEFAULT_PRINT_SETTINGS.startStep);
  const [endStep, setEndStep] = useState("");
  const [rowsPerColumn, setRowsPerColumn] = useState(DEFAULT_PRINT_SETTINGS.rowsPerColumn);

  useEffect(() => {
    let active = true;
    loadLatestPattern()
      .then((savedPattern) => {
        if (!active) return;
        setPattern(savedPattern);
        setEndStep(savedPattern?.lineCount || "");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const printDocument = (target) => {
    const className = `print-${target}-only`;
    const cleanup = () => document.body.classList.remove(className);
    document.body.classList.add(className);
    window.addEventListener("afterprint", cleanup, { once: true });
    requestAnimationFrame(() => window.print());
  };

  if (loading) {
    return <main className="print-loading">Готовлю инструкцию...</main>;
  }

  if (!pattern) {
    return (
      <main className="print-empty">
        <h1>Нет готовой схемы</h1>
        <p>Сначала загрузите схему или постройте макет в генераторе.</p>
        <a className="command-link" href="/">
          <ArrowLeft aria-hidden="true" size={18} />
          В генератор
        </a>
      </main>
    );
  }

  return (
    <main className="print-page">
      <header className="print-toolbar">
        <div className="print-toolbar-title">
          <a className="back-link" href="/">
            <ArrowLeft aria-hidden="true" size={18} />
            Генератор
          </a>
          <h1>Инструкция для печати</h1>
          <p>{pattern.pointCount} точек · {pattern.lineCount} соединений</p>
        </div>

        <div className="print-settings">
          <fieldset className="print-settings-group">
            <legend>Обложка</legend>
            <div className="print-settings-grid cover-settings-grid">
              <label>
                Язык инструкции
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                >
                  <option value="uk">Українська</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                Превью
                <select
                  value={coverImage}
                  onChange={(event) => setCoverImage(event.target.value)}
                >
                  <option value="artwork">Макет картины</option>
                  <option value="source" disabled={!pattern.sourcePreviewDataUrl}>Исходное фото</option>
                  <option value="none">Без изображения</option>
                </select>
              </label>
              <label className="print-check">
                <input
                  type="checkbox"
                  checked={includeStickerStep}
                  onChange={(event) => setIncludeStickerStep(event.target.checked)}
                />
                Пункт про наліпки
              </label>
            </div>
          </fieldset>

          <fieldset className="print-settings-group">
            <legend>Таблица шагов</legend>
            <div className="print-settings-grid instruction-settings-grid">
              <label>
                С шага
                <input
                  type="number"
                  min="1"
                  max={pattern.lineCount}
                  value={startStep}
                  onChange={(event) => setStartStep(event.target.value)}
                />
              </label>
              <label>
                По шаг
                <input
                  type="number"
                  min="1"
                  max={pattern.lineCount}
                  value={endStep}
                  onChange={(event) => setEndStep(event.target.value)}
                />
              </label>
              <label>
                Строк в колонке
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
                Полосатые строки
              </label>
            </div>
          </fieldset>
        </div>

        <div className="print-actions">
          <button className="print-action secondary-print-action" type="button" onClick={() => printDocument("cover")}>
            <Printer aria-hidden="true" size={19} />
            PDF обложки
          </button>
          <button className="print-action" type="button" onClick={() => printDocument("instruction")}>
            <Printer aria-hidden="true" size={19} />
            PDF инструкции
          </button>
        </div>
      </header>

      <div className="print-preview">
        <section className="print-document-section cover-document">
          <div className="print-document-heading">
            <h2>Титульный лист</h2>
            <span>Отдельный документ · 1 страница</span>
          </div>
          <CoverSheet
            image={coverImage === "none" ? null : coverPreview}
            language={language}
            includeStickerStep={includeStickerStep}
          />
        </section>

        <section className="print-document-section instruction-document">
          <div className="print-document-heading">
            <div>
              <h2>Таблица шагов</h2>
              <p>Для двусторонней печати выберите в диалоге принтера сначала чётные, затем нечётные страницы.</p>
            </div>
            <span>{pages.length} стр.</span>
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

function CoverSheet({ image, language, includeStickerStep }) {
  const copy = COVER_COPY[language] || COVER_COPY.uk;
  const steps = [
    includeStickerStep ? copy.stickerStep : null,
    copy.tieStep,
    copy.buildStep,
  ].filter(Boolean);

  return (
    <section className="print-sheet cover-sheet">
      <div className={`cover-image${image ? "" : " is-empty"}`}>
        {image && <img src={image} alt="Превью картины String Art" />}
      </div>
      <h2>{copy.title}</h2>
      <ol>
        {steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="cover-note">{copy.note}</p>
      <footer className="cover-brand">
        <span>{copy.instagram}</span>
        <img src="/instagram-qr.png" alt="@STRING_ART_DNIPRO" />
      </footer>
    </section>
  );
}

function InstructionSheet({ columns, stripedRows, language }) {
  const stepLabel = (COVER_COPY[language] || COVER_COPY.uk).step;

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
