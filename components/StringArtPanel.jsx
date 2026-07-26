"use client";

import FileImage from "lucide-react/dist/esm/icons/file-image.mjs";
import FileText from "lucide-react/dist/esm/icons/file-text.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";
import Printer from "lucide-react/dist/esm/icons/printer.mjs";

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
          Минимальный пропуск точек
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
          Print
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
