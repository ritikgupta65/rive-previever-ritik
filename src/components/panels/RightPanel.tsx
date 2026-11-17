"use client";

import type { Background } from "@/lib/controller";
import { PauseIcon, PlayIcon, ResetIcon, StopIcon } from "../Icons";
import { useController, usePreviewerState } from "../PreviewerContext";

const BACKGROUNDS: { id: Background; label: string }[] = [
  { id: "checker", label: "Checker" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];

function StructureSection() {
  const c = useController();
  const artboards = usePreviewerState((s) => s.artboards);
  const artboard = usePreviewerState((s) => s.artboard);
  const sms = usePreviewerState((s) => s.stateMachines);
  const sm = usePreviewerState((s) => s.stateMachine);
  const anims = usePreviewerState((s) => s.animations);

  return (
    <div className="section" id="structureSection">
      <h2>Structure</h2>
      <div className="field">
        <label className="lbl" htmlFor="artboardSel">
          Artboard
        </label>
        <select id="artboardSel" value={artboard ?? ""} disabled={artboards.length <= 1} onChange={(e) => c.selectArtboard(e.target.value)}>
          {artboards.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="smSel">
          State machine
        </label>
        {sms.length ? (
          <select id="smSel" value={sm ?? ""} onChange={(e) => c.selectStateMachine(e.target.value)}>
            {sms.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <select id="smSel" disabled>
            <option>— none —</option>
          </select>
        )}
      </div>
      {/* always mounted (hidden when unused) so field spacing matches the original */}
      <div className="field" id="animField" style={anims.length ? undefined : { display: "none" }}>
        <label className="lbl" htmlFor="animSel">
          Animation (no state machine)
        </label>
        <select id="animSel" key={anims.join("\u0000")} defaultValue={anims[0]} onChange={(e) => c.selectAnimation(e.target.value)}>
          {anims.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PlaybackSection() {
  const c = useController();
  return (
    <div className="section" id="playbackSection">
      <h2>Playback</h2>
      <div className="transport">
        <button className="btn" id="playBtn" title="Play" onClick={c.play}>
          <PlayIcon />
        </button>
        <button className="btn" id="pauseBtn" title="Pause" onClick={c.pause}>
          <PauseIcon />
        </button>
        <button className="btn" id="stopBtn" title="Stop" onClick={c.stop}>
          <StopIcon />
        </button>
        <button className="btn" id="resetBtn" title="Reset" onClick={c.reset}>
          <ResetIcon />
        </button>
      </div>
    </div>
  );
}

function LayoutSection() {
  const c = useController();
  const fitOptions = usePreviewerState((s) => s.fitOptions);
  const alignOptions = usePreviewerState((s) => s.alignOptions);
  const fit = usePreviewerState((s) => s.fit);
  const align = usePreviewerState((s) => s.align);
  const bg = usePreviewerState((s) => s.background);

  return (
    <div className="section" id="layoutSection">
      <h2>Layout</h2>
      <div className="field">
        <label className="lbl" htmlFor="fitSel">
          Fit
        </label>
        <select id="fitSel" value={fit} onChange={(e) => c.setLayout(e.target.value, align)}>
          {fitOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="alignSel">
          Alignment
        </label>
        <select id="alignSel" value={align} onChange={(e) => c.setLayout(fit, e.target.value)}>
          {alignOptions.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label className="lbl">Stage background</label>
        <div className="seg" id="bgSeg">
          {BACKGROUNDS.map((b) => (
            <button key={b.id} className={bg === b.id ? "on" : undefined} onClick={() => c.setBackground(b.id)}>
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Right card: everything that controls how the file plays (artboard / state machine, transport, layout). */
export default function RightPanel() {
  const loaded = usePreviewerState((s) => s.loaded);
  return (
    <aside className="card side right">
      <div className="card-head">
        <span className="panel-label">Controls</span>
      </div>
      <div className="scroll">
        {loaded ? (
          <>
            <StructureSection />
            <PlaybackSection />
            <LayoutSection />
          </>
        ) : (
          <div className="section">
            <div className="empty-hint">Load a .riv file to pick artboards, control playback and layout.</div>
          </div>
        )}
      </div>
    </aside>
  );
}
