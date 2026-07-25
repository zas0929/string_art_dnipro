"use client";

import FileImage from "lucide-react/dist/esm/icons/file-image.mjs";
import FileText from "lucide-react/dist/esm/icons/file-text.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";

export default function StringArtPanel() {
  return (
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
          <select id="threadInput" defaultValue="0.19">
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
          <select id="algorithmInput" defaultValue="portrait-v5">
            <option value="portrait-v4">Портрет v4 · оптическая модель</option>
            <option value="portrait-v5">Портрет v5 · стабильный</option>
            <option value="portrait-v6">Портрет v6 · экспериментальный</option>
            <option value="reference-v7">Reference v7 · эталонное ядро</option>
          </select>
        </label>
        <div id="enhancementControls" className="enhancement-controls is-disabled">
          <label className="toggle-control">
            <input id="enhanceInput" type="checkbox" />
            <span>Усилить детали макета</span>
          </label>
          <label>
            <span className="range-label">
              Тональный контраст
              <output id="contrastValue" htmlFor="contrastInput">25%</output>
            </span>
            <input
              id="contrastInput"
              type="range"
              aria-label="Тональный контраст"
              min="0"
              max="100"
              step="1"
              defaultValue="25"
              disabled
            />
          </label>
          <label>
            <span className="range-label">
              Приоритет деталей
              <output id="sharpnessValue" htmlFor="sharpnessInput">55%</output>
            </span>
            <input
              id="sharpnessInput"
              type="range"
              aria-label="Приоритет деталей"
              min="0"
              max="100"
              step="1"
              defaultValue="55"
              disabled
            />
          </label>
        </div>
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
      </div>

      <a id="buildModeLink" className="command-link" href="/build">
        <ListChecks aria-hidden="true" size={18} strokeWidth={2} />
        Режим сборки
      </a>

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
  );
}
