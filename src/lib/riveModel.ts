/* eslint-disable @typescript-eslint/no-explicit-any */
// Helpers that read Rive files across runtime API variants. The runtime's
// view-model surface differs between versions (high-level `vm.properties`
// vs low-level `vm.getProperties()`), so these stay deliberately loose.
import type * as RiveNS from "@rive-app/webgl2";
import { fmtBytes, safeArr } from "./format";

export type RiveModule = typeof RiveNS;
export type AnyRive = any;

export type PropType =
  | "trigger"
  | "boolean"
  | "number"
  | "color"
  | "enum"
  | "string"
  | "list"
  | "image"
  | "nested"
  | string;

export interface VMPropDesc {
  name: string;
  type: unknown;
}

/** Read view-model property descriptors across runtime variants. */
export function getVMProps(vm: any): VMPropDesc[] {
  if (!vm) return [];
  try {
    const a = vm.properties;
    if (a && a.length) return Array.prototype.map.call(a, (p: any) => ({ name: p.name, type: p.type })) as VMPropDesc[];
  } catch {
    /* ignore */
  }
  try {
    const g = vm.getProperties ? vm.getProperties() : null;
    if (g) {
      const len = typeof g.size === "function" ? g.size() : g.length;
      const out: VMPropDesc[] = [];
      for (let i = 0; i < len; i++) {
        const p = typeof g.get === "function" ? g.get(i) : g[i];
        if (p) out.push({ name: p.name, type: p.type });
      }
      if (out.length) return out;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function normType(t: unknown): PropType {
  const s = String(t || "").toLowerCase();
  if (s.includes("trigger")) return "trigger";
  if (s.includes("bool")) return "boolean";
  if (s.includes("num")) return "number";
  if (s.includes("color") || s.includes("colour")) return "color";
  if (s.includes("enum")) return "enum";
  if (s.includes("string")) return "string";
  if (s.includes("list")) return "list";
  if (s.includes("image") || s.includes("asset")) return "image";
  if (s.includes("view") || s.includes("nested") || s.includes("artboard")) return "nested";
  return s || "readonly";
}

export function mapType(R: RiveModule, t: unknown): PropType {
  const DT = (R as any).DataType;
  if (typeof t === "number" && DT) {
    for (const k in DT) if (DT[k] === t) return normType(k);
  }
  return normType(t);
}

export function listViewModels(r: AnyRive): any[] {
  const out: any[] = [];
  let count = 0;
  try {
    count = r.viewModelCount || 0;
  } catch {
    /* ignore */
  }
  for (let i = 0; i < count; i++) {
    try {
      const vm = r.viewModelByIndex(i);
      if (vm) out.push(vm);
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function vmByName(r: AnyRive, name: string | null): any {
  const vms = listViewModels(r);
  for (const vm of vms) if (vm.name === name) return vm;
  return vms[0] || null;
}

export function instanceNamesOf(vm: any): string[] {
  let names: string[] = [];
  try {
    const n = vm.instanceNames;
    if (n) {
      if (n.length != null) names = Array.prototype.slice.call(n);
      else if (n.size) for (let i = 0; i < n.size(); i++) names.push(n.get(i));
    }
  } catch {
    /* ignore */
  }
  if (!names.length) {
    try {
      const g = vm.getInstanceNames ? vm.getInstanceNames() : null;
      if (g) {
        const len = typeof g.size === "function" ? g.size() : g.length;
        for (let i = 0; i < len; i++) names.push(typeof g.get === "function" ? g.get(i) : g[i]);
      }
    } catch {
      /* ignore */
    }
  }
  return names.filter((x) => x != null && x !== "");
}

/** Find the view model whose declared properties all resolve on a nested instance. */
export function resolveChildVM(R: RiveModule, r: AnyRive, childVMI: any): any {
  if (!childVMI) return null;
  let count = 0;
  try {
    count = r.viewModelCount || 0;
  } catch {
    count = 0;
  }
  for (let i = 0; i < count; i++) {
    let vm: any = null;
    try {
      vm = r.viewModelByIndex(i);
    } catch {
      continue;
    }
    if (!vm) continue;
    const props = getVMProps(vm);
    if (!props.length) continue;
    let ok = true;
    for (const p of props) {
      const t = mapType(R, p.type);
      const nm = p.name;
      let hit = false;
      try {
        if (t === "number") hit = !!childVMI.number(nm);
        else if (t === "string") hit = !!childVMI.string(nm);
        else if (t === "boolean") hit = !!childVMI.boolean(nm);
        else if (t === "color") hit = !!childVMI.color(nm);
        else if (t === "enum") hit = !!childVMI.enum(nm);
        else if (t === "trigger") hit = !!childVMI.trigger(nm);
        else hit = true;
      } catch {
        hit = false;
      }
      if (!hit) {
        ok = false;
        break;
      }
    }
    if (ok) return vm;
  }
  return null;
}

export function hasDataBinding(r: AnyRive): boolean {
  let vm: any = null;
  try {
    vm = r.defaultViewModel ? r.defaultViewModel() : null;
  } catch {
    /* ignore */
  }
  if (!vm) {
    try {
      vm = r.viewModelCount ? r.viewModelByIndex(0) : null;
    } catch {
      /* ignore */
    }
  }
  return !!(vm && getVMProps(vm).length);
}

export function inputTypeName(R: RiveModule, type: unknown): "trigger" | "boolean" | "number" {
  const T = R.StateMachineInputType;
  return type === T.Trigger ? "trigger" : type === T.Boolean ? "boolean" : "number";
}

// ---------------------------------------------------------------- report

interface ReportCtx {
  R: RiveModule;
  r: AnyRive;
  fileMeta: { name: string; size: number };
  currentArtboard: string | null;
  currentSM: string | null;
}

export function buildReport({ R, r, fileMeta, currentArtboard, currentSM }: ReportCtx): string {
  if (!r) return "No file loaded.";
  const out: string[] = [];
  out.push("POPCORN · RIVE FILE REPORT");
  out.push("file: " + fileMeta.name + "  (" + fmtBytes(fileMeta.size) + ")");
  out.push("artboards: " + safeArr<string>(r.artboardNames).join(", "));
  out.push("current artboard: " + (currentArtboard || "(default)"));
  out.push("state machines: " + (safeArr<string>(r.stateMachineNames).join(", ") || "none"));
  out.push("animations: " + (safeArr<string>(r.animationNames).join(", ") || "none"));
  out.push("");
  out.push("STATE MACHINE INPUTS (" + (currentSM || "—") + "):");
  try {
    const ins: any[] = currentSM ? r.stateMachineInputs(currentSM) : [];
    (ins || []).forEach((i) => {
      const ty = inputTypeName(R, i.type);
      out.push("  - " + i.name + " : " + ty + (ty !== "trigger" ? " = " + i.value : ""));
    });
    if (!ins || !ins.length) out.push("  (none)");
  } catch {
    out.push("  (unavailable)");
  }
  out.push("");
  out.push("DATA BINDING:");
  try {
    let vm: any = r.defaultViewModel ? r.defaultViewModel() : null;
    if (!vm) {
      try {
        vm = r.viewModelCount ? r.viewModelByIndex(0) : null;
      } catch {
        /* ignore */
      }
    }
    const vmi = r.viewModelInstance;
    if (vm) {
      out.push("  view model: " + (vm.name || "(unnamed)"));
      reportVM(R, r, vm, vmi, out, "  ");
    } else out.push("  (no view model)");
  } catch {
    out.push("  (unavailable)");
  }
  return out.join("\n");
}

function reportVM(R: RiveModule, r: AnyRive, vm: any, vmi: any, out: string[], ind: string): void {
  getVMProps(vm).forEach((p) => {
    const t = mapType(R, p.type);
    const nm = p.name;
    try {
      if (!vmi) {
        out.push(ind + "- " + nm + " : " + t);
        return;
      }
      if (t === "number") out.push(ind + "- " + nm + " : number = " + vmi.number(nm).value);
      else if (t === "string") out.push(ind + "- " + nm + ' : string = "' + vmi.string(nm).value + '"');
      else if (t === "boolean") out.push(ind + "- " + nm + " : boolean = " + vmi.boolean(nm).value);
      else if (t === "color") out.push(ind + "- " + nm + " : color = 0x" + (vmi.color(nm).value >>> 0).toString(16).toUpperCase());
      else if (t === "enum") {
        const e = vmi.enum(nm);
        out.push(ind + "- " + nm + " : enum = " + e.value + "  [" + (e.values || []).join("|") + "]");
      } else if (t === "trigger") out.push(ind + "- " + nm + " : trigger");
      else if (t === "nested") {
        out.push(ind + "- " + nm + " : nested model");
        const c = vmi.viewModel(nm);
        const cv = resolveChildVM(R, r, c);
        if (c && cv) reportVM(R, r, cv, c, out, ind + "    ");
      } else out.push(ind + "- " + nm + " : " + t);
    } catch {
      out.push(ind + "- " + nm + " : (" + t + ", unreadable)");
    }
  });
}
