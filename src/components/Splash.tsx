"use client";

import { usePreviewerState, useController } from "./PreviewerContext";

interface SplashProps {
  stageRef: React.Ref<HTMLDivElement>;
  canvasRef: React.Ref<HTMLCanvasElement>;
}

/** Opening loader: the popcoin plays, then flies into the header logo. */
export default function Splash({ stageRef, canvasRef }: SplashProps) {
  const { dismissSplash } = useController();
  const splash = usePreviewerState((s) => s.splash);
  if (splash.phase === "gone") return null;
  const cls = splash.phase === "flying" ? "flying" : splash.phase === "hide" ? "hide" : undefined;
  return (
    <div id="splash" className={cls} aria-hidden="true" onClick={dismissSplash}>
      <div className="splash-bg" />
      <div className="splash-inner">
        <div className="splash-stage" id="splashStage" ref={stageRef} style={splash.transform ? { transform: splash.transform } : undefined}>
          <canvas id="splashCanvas" ref={canvasRef} width={200} height={200} />
        </div>
        <div className="splash-word">POPcorn</div>
        <div className="splash-skip">click anywhere to skip</div>
      </div>
    </div>
  );
}
