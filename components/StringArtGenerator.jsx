"use client";

import {
  Download,
  FileImage,
  FileText,
  ImagePlus,
  Play,
  RotateCcw,
  Square,
  Upload,
} from "lucide-react";
import { useEffect } from "react";

export default function StringArtGenerator() {
  useEffect(() => {
    import("../app.js").catch((error) => {
      const status = document.getElementById("status");
      if (status) status.textContent = `Ошибка запуска: ${error.message}`;
    });
  }, []);

  return (
    <main className="app">
      <section className="workspace">
        <div className="topbar">
          <div>
            <h1>String Art Generator</h1>
            <p>Фото или готовая схема в макет натяжения нити между пронумерованными точками.</p>
          </div>
          <div className="topbar-actions">
            <label className="file-button">
              <Upload aria-hidden="true" size={18} strokeWidth={2} />
              <input id="schemeInput" type="file" accept=".txt,.csv,text/plain,text/csv" />
              Загрузить схему
            </label>
            <label className="file-button">
              <ImagePlus aria-hidden="true" size={18} strokeWidth={2} />
              <input id="imageInput" type="file" accept="image/*" />
              Загрузить фото
            </label>
          </div>
        </div>

        <div className="stage">
          <canvas id="resultCanvas" width="760" height="760" aria-label="Макет картины из нитей" />
          <canvas id="sourceCanvas" width="760" height="760" aria-label="Исходное фото и выбранный кадр" />
        </div>

        <div className="status-row" aria-live="polite">
          <span id="status">Загрузите фото для расчёта или готовую схему для просмотра.</span>
          <progress id="progress" value="0" max="1" aria-label="Прогресс построения" />
        </div>
      </section>

      <aside className="panel">
        <div className="control-group">
          <h2>Параметры</h2>
          <label>
            Точек
            <input id="pointsInput" type="number" min="60" max="600" step="10" defaultValue="240" />
          </label>
          <label>
            Линий
            <input id="linesInput" type="number" min="100" max="8000" step="100" defaultValue="4500" />
          </label>
          <label>
            Размер картины, см
            <input id="sizeInput" type="number" min="10" max="200" step="1" defaultValue="47" />
          </label>
          <label>
            Толщина нити, мм
            <select id="threadInput" defaultValue="0.16">
              <option value="0.11">0.11 - тонкая</option>
              <option value="0.16">0.16 - средняя</option>
              <option value="0.19">0.19 - обычная</option>
            </select>
          </label>
          <label>
            Сила линии
            <input id="opacityInput" type="range" min="4" max="36" step="1" defaultValue="12" />
          </label>
          <label>
            Минимальный пропуск точек
            <input id="skipInput" type="number" min="2" max="80" step="1" defaultValue="15" />
          </label>
          <label>
            Режим
            <select id="algorithmInput" defaultValue="portrait-v4">
              <option value="portrait-v4">Портрет v4 · оптическая модель</option>
              <option value="portrait-v5">Портрет v5 · мульти-масштаб</option>
              <option value="portrait-v3">Портрет v3 · эталон</option>
              <option value="portrait-v2">Портрет v2</option>
              <option value="portrait">Портрет v1</option>
              <option value="classic">Классический</option>
            </select>
          </label>
          <label>
            Зум фото
            <input id="zoomInput" type="range" min="1" max="4" step="0.01" defaultValue="1" />
          </label>
          <button id="resetCropButton" type="button">
            <RotateCcw aria-hidden="true" size={18} strokeWidth={2} />
            Сбросить кадр
          </button>
        </div>

        <div className="actions">
          <button id="buildButton" type="button">
            <Play aria-hidden="true" size={18} fill="currentColor" strokeWidth={2} />
            Построить
          </button>
          <button id="stopButton" type="button" disabled>
            <Square aria-hidden="true" size={16} fill="currentColor" strokeWidth={2} />
            Стоп
          </button>
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
          <button id="csvButton" type="button" disabled>
            <Download aria-hidden="true" size={17} strokeWidth={2} />
            CSV
          </button>
        </div>

        <div className="summary">
          <h2>Инструкция</h2>
          <dl>
            <div><dt>Точек</dt><dd id="pointsOut">-</dd></div>
            <div><dt>Линий</dt><dd id="linesOut">-</dd></div>
            <div><dt>Шаг</dt><dd id="stepOut">-</dd></div>
            <div><dt>Длина нити</dt><dd id="lengthOut">-</dd></div>
          </dl>
          <textarea
            id="sequenceOutput"
            readOnly
            spellCheck="false"
            placeholder="Здесь появится последовательность точек."
            aria-label="Последовательность соединения точек"
          />
        </div>
      </aside>
    </main>
  );
}
