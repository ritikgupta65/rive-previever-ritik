"use client";

import { fmtBytes } from "@/lib/format";
import { useController, usePreviewerState } from "../PreviewerContext";
import DataPanel from "./DataPanel";
import InputsPanel from "./InputsPanel";

function FileSection() {
  const file = usePreviewerState((s) => s.file);
  return (
    <div className="section">
      <h2>File</h2>
      <div className="fileinfo" id="fileInfo">
        {file ? (
          <>
            <div className="fn">{file.name}</div>
            <div className="kv">
              size <b>{fmtBytes(file.size)}</b>
            </div>
            <div className="kv">
              artboards <b>{file.artboards}</b>
            </div>
          </>
        ) : (
          <span className="empty-hint">No file loaded.</span>
        )}
      </div>
    </div>
  );
}

/** Left card: the file plus everything that feeds values into it (state-machine inputs, data binding). */
export default function LeftPanel() {
  const c = useController();
  return (
    <aside className="card side left">
      <div className="card-head">
        <span className="panel-label">Input</span>
        <button className="pill-btn orange sm" id="openBtn" onClick={c.pick}>
          <span className="pill-label">Open .riv</span>
        </button>
      </div>
      <div className="scroll">
        <FileSection />
        <InputsPanel />
        <DataPanel />
      </div>
    </aside>
  );
}
