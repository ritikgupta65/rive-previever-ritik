"use client";

import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getServerLogSnapshot, logStore } from "@/lib/logStore";

export default function EventConsole() {
  const items = useSyncExternalStore(logStore.subscribe, logStore.getSnapshot, getServerLogSnapshot);
  const [filter, setFilter] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const f = filter.toLowerCase();
    return f ? items.filter((it) => (it.tag + " " + it.msg).toLowerCase().includes(f)) : items;
  }, [items, filter]);

  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible]);

  return (
    <div className="console">
      <div className="console-head">
        <h2>Event console</h2>
        <div className="spacer" />
        <input type="text" className="filter-in" id="logFilter" placeholder="filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className="mini-btn" id="clearLog" onClick={logStore.clear}>
          Clear
        </button>
      </div>
      <div id="log" ref={logRef}>
        {!items.length ? (
          <div className="log-empty">State changes, custom Rive events and fired triggers will stream here.</div>
        ) : !visible.length ? (
          <div className="log-empty">No lines match the filter.</div>
        ) : (
          visible.map((it) => (
            <div key={it.id} className={"logline " + it.kind}>
              <span className="ts">{it.t}</span>
              <span className="tag">{it.tag}</span>
              <span className="msg">{it.msg}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
