/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Fragment } from "react";
import { log } from "@/lib/logStore";
import type { DataNode } from "@/lib/panels";
import { BoolRow, ColorRow, EnumRow, ImageRow, NumberRow, ReadonlyRow, StringRow, TriggerRow } from "../controls/rows";
import { usePropObserver } from "../controls/usePropObserver";
import { useController, usePreviewerState } from "../PreviewerContext";

function TriggerNode({ name, prop }: { name: string; prop: any }) {
  usePropObserver(prop, () => log("trigger", "[recv]", name + "  (fired inside animation)"));
  return (
    <TriggerRow
      name={name}
      onFire={() => {
        try {
          prop.trigger();
        } catch {
          try {
            prop.fire();
          } catch {
            /* ignore */
          }
        }
        log("trigger", "[fire]", name + "  (data-binding)");
      }}
    />
  );
}

function Node({ node }: { node: DataNode }) {
  const c = useController();
  switch (node.kind) {
    case "number": {
      const p = node.prop;
      return <NumberRow name={node.name} initial={Number(p.value) || 0} onChange={(v) => (p.value = v)} observe={p} />;
    }
    case "string": {
      const p = node.prop;
      return <StringRow name={node.name} initial={p.value == null ? "" : String(p.value)} onChange={(v) => (p.value = v)} observe={p} />;
    }
    case "boolean": {
      const p = node.prop;
      return <BoolRow name={node.name} initial={!!p.value} onChange={(v) => (p.value = v)} observe={p} />;
    }
    case "color": {
      const p = node.prop;
      return (
        <ColorRow
          name={node.name}
          argb={p.value >>> 0}
          onChange={(v) => {
            try {
              p.value = v;
            } catch {
              try {
                p.value = v | 0;
              } catch {
                /* ignore */
              }
            }
          }}
        />
      );
    }
    case "enum": {
      const p = node.prop;
      return <EnumRow name={node.name} initial={p.value} values={node.values} onChange={(v) => (p.value = v)} observe={p} />;
    }
    case "trigger":
      return <TriggerNode name={node.name} prop={node.prop} />;
    case "nested":
      return (
        <div className="nested-group">
          <div className="nested-head">
            ▸ {node.name} <span className="nested-tag">nested model</span>
          </div>
          <div className="nested-body">
            {node.children ? (
              <NodeList nodes={node.children} />
            ) : (
              <div className="empty-hint">nested instance present (properties not enumerable in this runtime)</div>
            )}
          </div>
        </div>
      );
    case "list":
      return <ReadonlyRow name={node.name} text={node.text} type="list" />;
    case "image":
      return <ImageRow name={node.name} onSet={(url) => c.setImageFromUrl(node.vmi, node.name, url)} />;
    default:
      return <ReadonlyRow name={node.name} text={node.text} type={node.type} />;
  }
}

function NodeList({ nodes }: { nodes: DataNode[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <Node key={i + ":" + n.name} node={n} />
      ))}
    </>
  );
}

export default function DataPanel() {
  const c = useController();
  const { gen, count, model } = usePreviewerState((s) => s.data);

  let content: React.ReactNode;
  if (model.kind === "initial")
    content = (
      <div className="empty-hint">
        View-model properties (numbers, strings, booleans, colors, enums, triggers, nested models &amp; lists) appear here.
      </div>
    );
  else if (model.kind === "none") content = <div className="empty-hint">This file has no data-binding view models.</div>;
  else {
    const showHead = model.vmNames || model.instanceNames;
    const b = model.body;
    content = (
      <>
        {showHead ? (
          <div className="db-head">
            {model.vmNames && (
              <div className="db-field">
                <label htmlFor="dbVMSel">View model</label>
                <select id="dbVMSel" value={model.vmName} onChange={(e) => c.selectViewModel(e.target.value)}>
                  {model.vmNames.map((n, i) => (
                    <option key={i} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {model.instanceNames && (
              <div className="db-field">
                <label htmlFor="dbInstSel">Instance</label>
                <select id="dbInstSel" value={model.selectedInstance ?? ""} onChange={(e) => c.selectInstance(e.target.value)}>
                  <option value="">— bound / default —</option>
                  {model.instanceNames.map((n, i) => (
                    <option key={i} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ) : (
          <div className="db-single">
            view model: <b>{model.vmName}</b>
          </div>
        )}
        <div>
          {b.kind === "unresolved" && <div className="empty-hint">{"Could not resolve an instance for “" + b.vmName + "”."}</div>}
          {b.kind === "empty" && <div className="empty-hint">{"View model “" + b.vmName + "” declares no readable properties."}</div>}
          {b.kind === "props" && <NodeList nodes={b.nodes} />}
        </div>
      </>
    );
  }

  return (
    <div className="section">
      <h2>
        Data binding <span className="count" id="vmCount">{count}</span>
      </h2>
      {/* keyed by build generation so every rebuild remounts rows, like the original DOM rebuild */}
      <div id="dataPanel">
        <Fragment key={gen}>{content}</Fragment>
      </div>
    </div>
  );
}
