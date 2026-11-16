"use client";

import { useEffect, useRef, useState } from "react";
import { PreviewerController } from "@/lib/controller";
import EventConsole from "./EventConsole";
import Header from "./Header";
import LeftPanel from "./panels/LeftPanel";
import RightPanel from "./panels/RightPanel";
import { PreviewerContext } from "./PreviewerContext";
import Splash from "./Splash";
import Stage from "./Stage";

export default function Previewer() {
  const [controller] = useState(() => new PreviewerController());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splashCanvasRef = useRef<HTMLCanvasElement>(null);
  const splashStageRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !stageRef.current || !fileInputRef.current) return;
    return controller.init({
      canvas: canvasRef.current,
      stage: stageRef.current,
      fileInput: fileInputRef.current,
      splashCanvas: splashCanvasRef.current,
      splashStage: splashStageRef.current,
      logo: logoRef.current,
    });
  }, [controller]);

  return (
    <PreviewerContext.Provider value={controller}>
      <Splash stageRef={splashStageRef} canvasRef={splashCanvasRef} />
      <Header logoRef={logoRef} fileInputRef={fileInputRef} />
      <div className="workspace">
        <LeftPanel />
        <div className="col center">
          <Stage stageRef={stageRef} canvasRef={canvasRef} />
          <EventConsole />
        </div>
        <RightPanel />
      </div>
    </PreviewerContext.Provider>
  );
}
