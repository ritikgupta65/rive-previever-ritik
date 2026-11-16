/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { log } from "@/lib/logStore";
import { BoolRow, NumberRow, TriggerRow } from "../controls/rows";
import { usePreviewerState } from "../PreviewerContext";

export default function InputsPanel() {
  const { gen, count, model } = usePreviewerState((s) => s.inputs);

  let body: React.ReactNode;
  if (model.kind === "initial") body = <div className="empty-hint">Load a file with a state machine to see its inputs.</div>;
  else if (model.kind === "noStateMachine") body = <div className="empty-hint">This artboard has no state machine.</div>;
  else if (model.kind === "noInputs")
    body = (
      <div className="empty-hint plain">
        {"“" + model.target + "” has no state-machine inputs."}
        {model.dataBinding && (
          <>
            {" "}This file is driven by <b>data binding</b> {"—"} its triggers and values are in the <b>Data binding</b> panel below.
          </>
        )}
      </div>
    );
  else
    body = model.rows.map((row, i) => {
      const inp: any = row.input;
      const key = gen + ":" + i;
      if (row.kind === "trigger")
        return (
          <TriggerRow
            key={key}
            name={row.name}
            onFire={() => {
              try {
                inp.fire();
              } catch {
                /* ignore */
              }
              log("trigger", "[fire]", row.name + "  (SM input)");
            }}
          />
        );
      if (row.kind === "boolean") return <BoolRow key={key} name={row.name} initial={!!inp.value} onChange={(v) => (inp.value = v)} />;
      return <NumberRow key={key} name={row.name} initial={Number(inp.value) || 0} onChange={(v) => (inp.value = v)} />;
    });

  return (
    <div className="section">
      <h2>
        State machine inputs <span className="count" id="smiCount">{count}</span>
      </h2>
      <div id="inputsPanel">{body}</div>
    </div>
  );
}
