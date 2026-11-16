"use client";

import { DEMO_SLOTS } from "@/lib/controller";
import { UploadIcon, WarningIcon } from "./Icons";
import { useController, usePreviewerState } from "./PreviewerContext";

export default function Dropzone() {
  const c = useController();
  const hidden = usePreviewerState((s) => s.dropHidden);
  const dragging = usePreviewerState((s) => s.dragging);
  const blocked = usePreviewerState((s) => s.wasmBlocked);

  const cls = "dropzone" + (hidden ? " hidden" : "") + (dragging ? " drag" : "");

  if (blocked !== null) {
    return (
      <div className={cls} id="dropzone">
        <div className="dz-ring danger">
          <WarningIcon />
        </div>
        <h2 className="dz-title">This preview can{"’"}t run the Rive engine</h2>
        <p className="dz-sub">
          The embedded preview blocks WebAssembly, which is what renders .riv files. <b>The file itself works</b> {"—"} download it and
          open it directly in your browser (double-click the saved file), then drag-and-drop will load your .riv.
        </p>
        <button className="pill-btn orange sm" id="dzOpen2" style={{ marginTop: 6 }} onClick={c.pick}>
          <span className="pill-label">Choose a .riv file anyway</span>
        </button>
        <p className="dz-note">technical reason: {blocked}</p>
      </div>
    );
  }

  return (
    <div className={cls} id="dropzone">
      <div className="dz-inner">
        <div className="drop-hero" id="dropHero">
          <div className="dz-ring" aria-hidden="true">
            <UploadIcon />
          </div>
          <h2 className="dz-title">
            Drop a <code>.riv</code> file to begin
          </h2>
          <p className="dz-sub">
            Drag it anywhere onto this box, or use the button below. The file is read locally in your browser — nothing is uploaded.
          </p>
          <button className="pill-btn orange dz-choose" id="dzOpen" onClick={c.pick}>
            <span className="pill-label">Choose a .riv file</span>
          </button>
        </div>
        <div className="demo-section">
          <div className="demo-head">
            <span className="demo-head-title">Demo files</span>
          </div>
          <div className="demo-grid">
            {DEMO_SLOTS.map((d) => (
              <button key={d.key} className="demo-card" data-demo={d.key} onClick={() => c.demoLoad(d.key)}>
                <span className="demo-thumb has-img" id={"thumb-" + d.key} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
