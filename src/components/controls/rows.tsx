/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useState } from "react";
import { hex } from "@/lib/format";
import { BoltIcon } from "../Icons";
import PropShell from "./PropShell";
import { usePropObserver } from "./usePropObserver";

const isFocused = (el: Element | null) => !!el && document.activeElement === el;

// ------------------------------------------------------------ number

interface NumberRowProps {
  name: string;
  initial: number;
  onChange: (v: number) => void;
  /** Live-bound view-model property, if any. */
  observe?: any;
  type?: string;
}

export function NumberRow({ name, initial, onChange, observe, type = "number" }: NumberRowProps) {
  const [value, setValue] = useState(String(initial));
  const ref = useRef<HTMLInputElement>(null);
  usePropObserver(observe, (v) => {
    if (!isFocused(ref.current)) setValue(String(v));
  });
  return (
    <PropShell name={name} type={type}>
      <div className="row-flex">
        <input
          ref={ref}
          type="number"
          step="any"
          className="grow num-in"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(v);
          }}
        />
      </div>
    </PropShell>
  );
}

// ------------------------------------------------------------ string

export function StringRow({ name, initial, onChange, observe }: { name: string; initial: string; onChange: (v: string) => void; observe?: any }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  usePropObserver(observe, (v) => {
    if (!isFocused(ref.current)) setValue(v == null ? "" : String(v));
  });
  return (
    <PropShell name={name} type="string">
      <input
        ref={ref}
        type="text"
        className="str-in"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
      />
    </PropShell>
  );
}

// ------------------------------------------------------------ boolean

export function BoolRow({ name, initial, onChange, observe, type = "boolean" }: { name: string; initial: boolean; onChange: (v: boolean) => void; observe?: any; type?: string }) {
  const [on, setOn] = useState(initial);
  usePropObserver(observe, (v) => setOn(!!v)); // live update without re-firing
  const toggle = () => {
    const v = !on;
    setOn(v);
    onChange(v);
  };
  return (
    <PropShell name={name} type={type}>
      <div
        className={"bool-ctl" + (on ? " on" : "")}
        tabIndex={0}
        role="switch"
        aria-checked={on}
        aria-label={name}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter" || e.key === "Spacebar") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span className="bool-state">{on ? "true" : "false"}</span>
        <span className="switch">
          <input type="checkbox" checked={on} readOnly tabIndex={-1} aria-hidden="true" />
          <span className="slide" />
        </span>
      </div>
    </PropShell>
  );
}

// ------------------------------------------------------------ color

export function ColorRow({ name, argb, onChange }: { name: string; argb: number; onChange: (v: number) => void }) {
  const [init] = useState(() => {
    let a = (argb >>> 24) & 255;
    const r = (argb >>> 16) & 255;
    const g = (argb >>> 8) & 255;
    const b = argb & 255;
    if (a === 0) a = 255;
    return { color: hex(r, g, b), alpha: a };
  });
  const [color, setColor] = useState(init.color);
  const [alpha, setAlpha] = useState(init.alpha);

  const emit = (h: string, a: number) => {
    const R = parseInt(h.substr(1, 2), 16);
    const G = parseInt(h.substr(3, 2), 16);
    const B = parseInt(h.substr(5, 2), 16);
    onChange(((a << 24) | (R << 16) | (G << 8) | B) >>> 0);
  };

  return (
    <PropShell name={name} type="color">
      <div className="color-row">
        <input
          type="color"
          value={color}
          onChange={(e) => {
            setColor(e.target.value);
            emit(e.target.value, alpha);
          }}
        />
        <input
          type="range"
          min={0}
          max={255}
          value={alpha}
          title="alpha"
          onChange={(e) => {
            const a = parseInt(e.target.value, 10);
            setAlpha(a);
            emit(color, a);
          }}
        />
        <span className="hexval">{"#" + color.substr(1).toUpperCase() + " α" + alpha}</span>
      </div>
    </PropShell>
  );
}

// ------------------------------------------------------------ enum

export function EnumRow({ name, initial, values, onChange, observe }: { name: string; initial: string; values: string[]; onChange: (v: string) => void; observe?: any }) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLSelectElement>(null);
  usePropObserver(observe, (v) => {
    if (!isFocused(ref.current)) setValue(v);
  });
  const options = values.length ? values : [initial];
  return (
    <PropShell name={name} type="enum">
      <select
        ref={ref}
        className="enum-in"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange(e.target.value);
        }}
      >
        {options.map((v, i) => (
          <option key={i} value={v}>
            {v}
          </option>
        ))}
      </select>
    </PropShell>
  );
}

// ------------------------------------------------------------ trigger

export function TriggerRow({ name, onFire, type = "trigger" }: { name: string; onFire: () => void; type?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <PropShell name={name} type={type}>
      <button
        ref={ref}
        className="trigger-btn"
        onClick={() => {
          onFire();
          const btn = ref.current;
          if (!btn) return;
          btn.classList.remove("pulse");
          void btn.offsetWidth; // restart the animation
          btn.classList.add("pulse");
        }}
      >
        <BoltIcon /> Fire
      </button>
    </PropShell>
  );
}

// ------------------------------------------------------------ read-only / image

export function ReadonlyRow({ name, text, type = "readonly" }: { name: string; text: string; type?: string }) {
  return (
    <PropShell name={name} type={type}>
      <div className="readonly-val">{text}</div>
    </PropShell>
  );
}

export function ImageRow({ name, onSet }: { name: string; onSet: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <PropShell name={name} type="image">
      <div className="row-flex">
        <input type="text" placeholder="image URL…" className="grow" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          className="btn"
          onClick={() => {
            const u = url.trim();
            if (u) onSet(u);
          }}
        >
          Set
        </button>
      </div>
    </PropShell>
  );
}
