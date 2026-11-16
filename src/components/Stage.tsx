"use client";

import Dropzone from "./Dropzone";
import { usePreviewerState } from "./PreviewerContext";

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
