"use client";

import { useController, usePreviewerState } from "./PreviewerContext";

interface HeaderProps {
  logoRef: React.Ref<HTMLImageElement>;
  fileInputRef: React.Ref<HTMLInputElement>;
}

export default function Header({ logoRef, fileInputRef }: HeaderProps) {
  const c = useController();
  const runtime = usePreviewerState((s) => s.runtime);
  const dotCls = "dot" + (runtime.status === "live" ? " live" : runtime.status === "err" ? " err" : "");

  return (
    <header>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="glyph-img" ref={logoRef} src="/images/logo.png" alt="" />
        <div>
          <h1>POPcorn</h1>
        </div>
      </div>
      <div className="spacer" />
      <div className="runtime-badge">
        <span className={dotCls} id="rtDot" />
        <span id="rtLabel">{runtime.label}</span>
      </div>
      <button className="pill-btn dark sm" id="reportBtn" title="Copy a text report of every interaction point" onClick={c.copyReport}>
        <span className="pill-label">Copy report</span>
      </button>
      <button className="pill-btn orange sm" id="openBtn" onClick={c.pick}>
        <span className="pill-label">Open .riv</span>
      </button>
      <input
        type="file"
        id="fileInput"
        accept=".riv"
        hidden
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) c.loadFile(f);
        }}
      />
    </header>
  );
}
