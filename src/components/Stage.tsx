"use client";

import Dropzone from "./Dropzone";
import { useController, usePreviewerState } from "./PreviewerContext";

interface StageProps {
  stageRef: React.Ref<HTMLDivElement>;
  canvasRef: React.Ref<HTMLCanvasElement>;
}

function Toolbar() {
  const loaded = usePreviewerState((s) => s.loaded);
  const size = usePreviewerState((s) => s.sizeText);
  const fps = usePreviewerState((s) => s.fpsText);
  const state = usePreviewerState((s) => s.stateText);
  if (!loaded) return null;
  return (
    <div className="stage-toolbar" id="stageToolbar">
      <span className="stat-chip" id="sizeChip">{size}</span>
      <span className="stat-chip" id="fpsChip">{fps}</span>
      <span className="stat-chip" id="stateChip">{state}</span>
    </div>
  );
}

/** Stage card header: tool title on the left, renderer status + report on the right. */
export function StageHead() {
  const c = useController();
  const runtime = usePreviewerState((s) => s.runtime);
  const fileName = usePreviewerState((s) => s.file?.name);
  const dotCls = "dot" + (runtime.status === "live" ? " live" : runtime.status === "err" ? " err" : "");
  return (
    <div className="card-head stage-head">
      <div className="stage-title">
        Rive Previewer
        {fileName && <span className="stage-file">{fileName}</span>}
      </div>
      <div className="stage-actions">
        <div className="runtime-badge">
          <span className={dotCls} id="rtDot" />
          <span id="rtLabel">{runtime.label}</span>
        </div>
        <button className="pill-btn dark sm" id="reportBtn" title="Copy a text report of every interaction point" onClick={c.copyReport}>
          <span className="pill-label">Copy report</span>
        </button>
      </div>
    </div>
  );
}

export default function Stage({ stageRef, canvasRef }: StageProps) {
  const bg = usePreviewerState((s) => s.background);
  return (
    <div className="stage-wrap">
      <div id="stage" ref={stageRef} className={"bg-" + bg}>
        <canvas id="canvas" ref={canvasRef} />
        <Toolbar />
        <Dropzone />
      </div>
    </div>
  );
}
