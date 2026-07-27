"use client";

import FileImage from "lucide-react/dist/esm/icons/file-image.mjs";
import FileText from "lucide-react/dist/esm/icons/file-text.mjs";
import ListChecks from "lucide-react/dist/esm/icons/list-checks.mjs";
import Printer from "lucide-react/dist/esm/icons/printer.mjs";

export default function StringArtPanel() {
  return (
    <aside className="panel">
      <div className="control-group">
        <h2>Settings</h2>
        <label>
          Pins
          <input id="pointsInput" type="number" min="60" max="600" step="10" defaultValue="240" />
        </label>
        <label>
          Lines
          <input id="linesInput" type="number" min="100" max="8000" step="100" defaultValue="5000" />
        </label>
        <label>
          Artwork size, cm
          <input id="sizeInput" type="number" min="10" max="200" step="1" defaultValue="47" />
        </label>
        <label>
          Thread thickness, mm
          <select id="threadInput" defaultValue="0.19">
            <option value="0.11">0.11 - thin</option>
            <option value="0.16">0.16 - medium</option>
            <option value="0.19">0.19 - standard</option>
            <option value="0.22">0.22 - thick</option>
            <option value="0.27">0.27 - extra thick</option>
            <option value="0.3">0.30 - maximum</option>
          </select>
        </label>
        <label>
          Minimum pin gap
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
        Build mode
      </a>

      <div className="summary">
        <h2>Pattern details</h2>
        <dl>
          <div><dt>Pins</dt><dd id="pointsOut">-</dd></div>
          <div><dt>Lines</dt><dd id="linesOut">-</dd></div>
          <div><dt>Step</dt><dd id="stepOut">-</dd></div>
          <div><dt>Thread length</dt><dd id="lengthOut">-</dd></div>
        </dl>
        <textarea
          id="sequenceOutput"
          readOnly
          spellCheck="false"
          placeholder="The pin sequence will appear here."
          aria-label="Pin connection sequence"
        />
      </div>
    </aside>
  );
}
