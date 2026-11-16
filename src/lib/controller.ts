/* eslint-disable @typescript-eslint/no-explicit-any */
import { errMessage, safeArr } from "./format";
import { hookConsole, log, logStore } from "./logStore";
import type { DataModel, DataNode, InputRow, InputsModel, PanelState } from "./panels";
import {
  type AnyRive,
  type RiveModule,
  buildReport,
  getVMProps,
  hasDataBinding,
  instanceNamesOf,
  listViewModels,
  mapType,
  resolveChildVM,
  vmByName,
} from "./riveModel";

/** Served from /public — previously inlined as base64 in the HTML. */
const WASM_URL = "/rive/rive.wasm";
const POPCOIN_URL = "/demos/popcoin.riv";

export type Background = "checker" | "dark" | "light";
export type SplashPhase = "show" | "flying" | "hide" | "gone";

export interface DemoSlot {
  key: string;
  name: string;
  /** File under /public/demos, or null for an empty slot. */
  asset: string | null;
}

// 3 reviewable demo slots. asset = file in /public/demos. null = empty slot awaiting a file.
export const DEMO_SLOTS: DemoSlot[] = [
  { key: "d1", name: "Package 1", asset: "pkg1" },
  { key: "d2", name: "Package 2", asset: "pkg2" },
  { key: "d3", name: "Package 3", asset: "pkg3" },
];

export interface PreviewerState {
  runtime: { status: "idle" | "live" | "err"; label: string };
  /** Reason string when WebAssembly could not start. */
  wasmBlocked: string | null;
  splash: { phase: SplashPhase; transform?: string };
  loaded: boolean;
  dropHidden: boolean;
  dragging: boolean;
  file: { name: string; size: number; artboards: number } | null;
  artboards: string[];
  artboard: string | null;
  stateMachines: string[];
  stateMachine: string | null;
  /** Shown only when the artboard has no state machine. */
  animations: string[];
  fitOptions: string[];
  alignOptions: string[];
  fit: string;
  align: string;
  background: Background;
  sizeText: string;
  fpsText: string;
  stateText: string;
  inputs: PanelState<InputsModel>;
  data: PanelState<DataModel>;
}

const initialState: PreviewerState = {
  runtime: { status: "idle", label: "starting…" },
  wasmBlocked: null,
  splash: { phase: "show" },
  loaded: false,
  dropHidden: false,
  dragging: false,
  file: null,
  artboards: [],
  artboard: null,
  stateMachines: [],
  stateMachine: null,
  animations: [],
  fitOptions: [],
  alignOptions: [],
  fit: "Contain",
  align: "Center",
  background: "checker",
  sizeText: "—",
  fpsText: "— fps",
  stateText: "state: —",
  inputs: { gen: 0, count: "0", model: { kind: "initial" } },
  data: { gen: 0, count: "0", model: { kind: "initial" } },
};

export interface PreviewerElements {
  canvas: HTMLCanvasElement;
  stage: HTMLElement;
  fileInput: HTMLInputElement;
  splashCanvas: HTMLCanvasElement | null;
  splashStage: HTMLElement | null;
  logo: HTMLElement | null;
}

function enumKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((k) => !/^\d+$/.test(k));
}

/**
 * Owns the Rive instance and every piece of imperative logic from the original
 * single-file tool. React subscribes to `state` via useSyncExternalStore.
 */
export class PreviewerController {
  state: PreviewerState = initialState;
  private listeners = new Set<() => void>();

  private R: RiveModule | null = null;
  private el: PreviewerElements | null = null;
  private r: AnyRive = null;
  private buffer: ArrayBuffer | null = null;
  private fileMeta = { name: "", size: 0 };
  private lastFit = "Contain";
  private lastAlign = "Center";
  private currentArtboard: string | null = null;
  private currentSM: string | null = null;
  private dbVMName: string | null = null; // selected view-model in the Data binding panel
  private dbInstName: string | null = null; // selected instance in the Data binding panel
  private wasmReady = false;
  private loadToken = 0;
  private panelGen = 0;
  private dragDepth = 0;
  private splashRive: AnyRive = null;
  private splashGone = false;
  private disposers: Array<() => void> = [];
  private disposed = false;

  // ------------------------------------------------------------ store plumbing

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): PreviewerState => this.state;
  getServerSnapshot = (): PreviewerState => initialState;

  private set(patch: Partial<PreviewerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  get rive(): RiveModule | null {
    return this.R;
  }

  // ------------------------------------------------------------ lifecycle

  init(el: PreviewerElements): () => void {
    this.el = el;
    hookConsole();
    this.startFps();
    this.watchStageSize();
    this.wireDragAndDrop();
    // hard cap so the splash never traps the user
    this.later(() => this.dismissSplash(), 4200);
    void this.loadRuntime();
    return () => this.dispose();
  }

  private dispose(): void {
    this.disposed = true;
    this.disposers.forEach((d) => {
      try {
        d();
      } catch {
        /* ignore */
      }
    });
    this.disposers = [];
    this.teardown();
    try {
      this.splashRive?.cleanup();
    } catch {
      /* ignore */
    }
  }

  private later(fn: () => void, ms: number): number {
    const id = window.setTimeout(fn, ms);
    this.disposers.push(() => window.clearTimeout(id));
    return id;
  }

  private async loadRuntime(): Promise<void> {
    let R: RiveModule | null = null;
    try {
      R = (await import("@rive-app/webgl2")) as RiveModule;
      if (!(R && R.Rive)) R = null;
    } catch {
      R = null;
    }
    if (this.disposed) return;
    if (!R) {
      this.set({ runtime: { status: "err", label: "runtime unavailable" } });
      return;
    }
    this.R = R;
    // The previewer intentionally inspects legacy features (state machine inputs,
    // Rive events, state-change and loop events) so it can show every interaction
    // point a .riv exposes. Silence the runtime's per-feature deprecation notices
    // for exactly those APIs; real engine errors are still mirrored to the console.
    try {
      R.Rive.suppressDeprecationWarnings = ["state-machine-inputs", "rive-events", "state-change-events", "loop-events"];
    } catch {
      /* older runtimes don't expose the setter */
    }
    const version = (R as any).version || "2.x";
    this.set({
      runtime: { status: "live", label: "Rive Renderer · v" + version },
      fitOptions: enumKeys(R.Fit as any),
      alignOptions: enumKeys(R.Alignment as any),
    });

    // Point the WebGL2 Rive Renderer at the locally served WASM (no CDN), so
    // there is no third-party fetch and feather / advanced rendering are available.
    try {
      R.RuntimeLoader.setWasmUrl(WASM_URL);
      R.RuntimeLoader.setWasmFallbackUrl?.(null);
    } catch {
      /* fall back to runtime default loader */
    }

    this.probe(version);
  }

  // ---- runtime readiness probe ----
  // Rive needs to COMPILE WebAssembly. Some embedded/preview sandboxes block that
  // (missing 'wasm-unsafe-eval'). Detect it early and say so, instead of failing silently.
  private probe(version: string): void {
    const R = this.R!;
    let done = false;
    const fail = (msg: string) => {
      if (done) return;
      done = true;
      this.dismissSplash();
      this.set({ runtime: { status: "err", label: "wasm blocked" }, wasmBlocked: msg || "WebAssembly unavailable", dropHidden: false });
      log("err", "[engine]", "WebAssembly could not start: " + (msg || ""));
    };
    const ok = () => {
      if (done) return;
      done = true;
      this.wasmReady = true;
      this.set({ runtime: { status: "live", label: "Rive Renderer · v" + version + " · ready" } });
      this.startSplash();
    };
    try {
      if (R.RuntimeLoader && R.RuntimeLoader.awaitInstance) {
        const t = window.setTimeout(() => fail("timed out compiling wasm"), 12000);
        R.RuntimeLoader.awaitInstance().then(
          () => {
            clearTimeout(t);
            ok();
          },
          (e) => {
            clearTimeout(t);
            fail(errMessage(e));
          },
        );
      } else ok();
    } catch (e) {
      fail(String(e));
    }
  }

  private startFps(): void {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - last >= 1000) {
        this.set({ fpsText: frames + " fps" });
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    this.disposers.push(() => cancelAnimationFrame(raf));
  }

  private stageSizeText(): string {
    const s = this.el!.stage;
    return s.clientWidth + "×" + s.clientHeight;
  }

  private watchStageSize(): void {
    const ro = new ResizeObserver(() => {
      if (!this.r) return;
      try {
        this.r.resizeDrawingSurfaceToCanvas();
      } catch {
        /* ignore */
      }
      this.set({ sizeText: this.stageSizeText() });
    });
    ro.observe(this.el!.stage);
    this.disposers.push(() => ro.disconnect());
  }

  private wireDragAndDrop(): void {
    const over = (e: DragEvent) => e.preventDefault();
    const enter = (e: DragEvent) => {
      e.preventDefault();
      this.dragDepth++;
      this.set({ dropHidden: false, dragging: true });
    };
    const leave = (e: DragEvent) => {
      e.preventDefault();
      this.dragDepth--;
      if (this.dragDepth <= 0) {
        this.dragDepth = 0;
        this.set({ dragging: false, dropHidden: this.r ? true : this.state.dropHidden });
      }
    };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      this.dragDepth = 0;
      this.set({ dragging: false });
      const f = e.dataTransfer?.files?.[0];
      if (f) {
        if (!/\.riv$/i.test(f.name)) {
          log("err", "[error]", "Not a .riv file: " + f.name);
          if (this.r) this.set({ dropHidden: true });
          return;
        }
        this.loadFile(f);
      } else if (this.r) {
        this.set({ dropHidden: true });
      }
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    this.disposers.push(() => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    });
  }

  // ------------------------------------------------------------ splash

  dismissSplash = (): void => {
    if (this.splashGone) return;
    this.splashGone = true;
    const logo = this.el?.logo;
    const stage = this.el?.splashStage;
    if (logo && stage) {
      const lr = logo.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      if (sr.width > 0 && lr.width > 0) {
        const scale = lr.width / sr.width;
        const dx = lr.left + lr.width / 2 - (sr.left + sr.width / 2);
        const dy = lr.top + lr.height / 2 - (sr.top + sr.height / 2);
        this.set({ splash: { phase: "flying" } });
        requestAnimationFrame(() =>
          this.set({ splash: { phase: "flying", transform: "translate(" + dx + "px," + dy + "px) scale(" + scale + ")" } }),
        );
      } else this.set({ splash: { phase: "hide" } });
    } else this.set({ splash: { phase: "hide" } });

    window.setTimeout(() => {
      try {
        this.splashRive?.cleanup();
      } catch {
        /* ignore */
      }
      this.splashRive = null;
      this.set({ splash: { phase: "gone" } });
    }, 860);
  };

  private startSplash(): void {
    if (this.splashGone) return;
    const R = this.R!;
    const canvas = this.el?.splashCanvas;
    if (canvas) {
      fetch(POPCOIN_URL)
        .then((res) => res.arrayBuffer())
        .then((buffer) => {
          if (this.splashGone) return;
          try {
            const sr: AnyRive = new R.Rive({
              buffer,
              canvas,
              autoplay: true,
              artboard: "Popcoin1 3",
              stateMachine: "State Machine 1",
              enableGPUCanvas: true,
              layout: new R.Layout({ fit: R.Fit.Contain, alignment: R.Alignment.Center }),
              onLoad: () => {
                try {
                  sr.resizeDrawingSurfaceToCanvas();
                } catch {
                  /* ignore */
                }
              },
            } as any);
            this.splashRive = sr;
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          /* splash is decorative */
        });
    }
    this.later(() => this.dismissSplash(), 1900); // let the loader breathe, then reveal the app
  }

  // ------------------------------------------------------------ loading

  pick = (): void => {
    const input = this.el?.fileInput;
    if (!input) return;
    input.value = "";
    input.click();
  };

  loadFile = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => this.loadArrayBuffer(reader.result as ArrayBuffer, file.name, file.size);
    reader.onerror = () => log("err", "[error]", "Could not read file.");
    reader.readAsArrayBuffer(file);
  };

  demoLoad = (key: string): void => {
    if (!this.wasmReady) {
      log("err", "[engine]", "Engine not ready — download & open locally to run demos.");
      return;
    }
    const slot = DEMO_SLOTS.find((s) => s.key === key);
    const label = slot ? slot.name : key;
    if (!slot || !slot.asset) {
      log("sys", "[demo]", "“" + label + "” is an empty slot — add a .riv to fill it.");
      return;
    }
    fetch("/demos/" + slot.asset + ".riv")
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.arrayBuffer();
      })
      .then((buf) => {
        log("sys", "[demo]", "loading " + label);
        this.loadArrayBuffer(buf, label + "  (demo)", buf.byteLength);
      })
      .catch((e) => log("err", "[error]", "Could not load demo: " + errMessage(e)));
  };

  private loadArrayBuffer(buf: ArrayBuffer, name: string, size?: number): void {
    this.buffer = buf;
    this.fileMeta = { name, size: size != null ? size : buf.byteLength || 0 };
    this.currentArtboard = null;
    this.currentSM = null;
    this.dbVMName = null;
    this.dbInstName = null;
    logStore.clear();
    this.instantiate({});
  }

  private teardown(): void {
    // Property observers are owned by the row components and unsubscribe on unmount.
    if (this.r) {
      try {
        this.r.cleanup();
      } catch {
        /* ignore */
      }
      this.r = null;
    }
  }

  private instantiate(opts: { artboard?: string; stateMachine?: string }): void {
    const R = this.R;
    if (!R || !this.el) return;
    this.teardown();
    const token = ++this.loadToken;
    const wantSM = opts.stateMachine || null;
    const params: any = {
      buffer: this.buffer,
      canvas: this.el.canvas,
      autoplay: true,
      autoBind: true,
      enableGPUCanvas: true,
      layout: new R.Layout({ fit: (R.Fit as any)[this.lastFit], alignment: (R.Alignment as any)[this.lastAlign] }),
      onLoad: () => {
        if (token === this.loadToken) this.onLoaded(!!wantSM);
      },
      onLoadError: (err: unknown) => {
        if (token !== this.loadToken) return;
        if (params.autoBind) {
          log("sys", "[info]", "No default view-model; retrying without auto-bind.");
          params.autoBind = false;
          try {
            this.r = new R.Rive(params);
          } catch (e) {
            log("err", "[error]", String(e));
          }
          return;
        }
        log("err", "[error]", "Failed to load: " + errMessage(err));
        if (!this.r) this.set({ dropHidden: false });
      },
      onStateChange: (ev: any) => {
        if (token !== this.loadToken) return;
        const names: string[] = ev && ev.data ? [].concat(ev.data) : [];
        if (names.length) {
          this.set({ stateText: "state: " + names.join(", ") });
          log("state", "[state]", names.join(", "));
        }
      },
    };
    if (opts.artboard) params.artboard = opts.artboard;
    if (wantSM) params.stateMachine = wantSM;
    try {
      this.r = new R.Rive(params);
    } catch (e) {
      log("err", "[error]", String(e));
    }
  }

  private onLoaded(loadedWithSM: boolean): void {
    const r = this.r;
    if (!r) return;
    try {
      r.resizeDrawingSurfaceToCanvas();
    } catch {
      /* ignore */
    }
    this.set({
      dropHidden: true,
      loaded: true,
      sizeText: this.stageSizeText(),
      file: { name: this.fileMeta.name, size: this.fileMeta.size, artboards: safeArr(r.artboardNames).length },
    });

    this.populateArtboards();

    // Make sure the STATE MACHINE is the running graph, and that the auto-bound view
    // model is bound to it — otherwise data-binding triggers won't drive transitions.
    // The first time we discover a state machine, reload once with it named explicitly.
    const sms = safeArr<string>(r.stateMachineNames);
    if (sms.length && !loadedWithSM) {
      this.currentSM = this.currentSM && sms.includes(this.currentSM) ? this.currentSM : sms[0];
      this.instantiate({ artboard: this.currentArtboard || undefined, stateMachine: this.currentSM });
      return;
    }

    this.attachEvents();
    this.buildInputsPanel();
    this.buildDataPanel();
    log(
      "sys",
      "[loaded]",
      this.fileMeta.name +
        "  ·  artboard “" +
        (this.currentArtboard || "default") +
        "”" +
        (this.currentSM ? "  ·  SM “" + this.currentSM + "”" : ""),
    );
  }

  private populateArtboards(): void {
    const abs = safeArr<string>(this.r.artboardNames);
    if (!(this.currentArtboard && abs.includes(this.currentArtboard))) this.currentArtboard = abs[0] || null;
    this.set({ artboards: abs, artboard: this.currentArtboard });
    this.populateStateMachines();
  }

  private populateStateMachines(): void {
    const r = this.r;
    const sms = safeArr<string>(r.stateMachineNames);
    if (sms.length) {
      if (!(this.currentSM && sms.includes(this.currentSM))) this.currentSM = sms[0];
    } else this.currentSM = null;
    const anims = safeArr<string>(r.animationNames);
    this.set({
      stateMachines: sms,
      stateMachine: this.currentSM,
      animations: !sms.length && anims.length ? anims : [],
    });
  }

  private attachEvents(): void {
    const ET = this.R!.EventType;
    const r = this.r;
    const arr = (ev: any) => (ev && ev.data ? [].concat(ev.data).join(", ") : "");
    try {
      r.on(ET.RiveEvent, (ev: any) => {
        const d = ev && ev.data ? ev.data : {};
        const props = d.properties ? JSON.stringify(d.properties) : "";
        const extra = d.url ? " → " + d.url : "";
        log("event", "[event]", (d.name || "(unnamed)") + (props ? "  " + props : "") + extra);
      });
    } catch {
      /* ignore */
    }
    try {
      r.on(ET.Loop, (ev: any) => {
        const d = ev && ev.data ? ev.data : {};
        log("sys", "[loop]", (d.animation || "") + " (" + (d.type || "") + ")");
      });
    } catch {
      /* ignore */
    }
    try {
      r.on(ET.Play, (ev: any) => log("sys", "[play]", arr(ev)));
    } catch {
      /* ignore */
    }
    try {
      r.on(ET.Pause, (ev: any) => log("sys", "[pause]", arr(ev)));
    } catch {
      /* ignore */
    }
    try {
      r.on(ET.Stop, (ev: any) => log("sys", "[stop]", arr(ev)));
    } catch {
      /* ignore */
    }
  }

  // ------------------------------------------------------------ panels

  private buildInputsPanel(): void {
    const R = this.R!;
    const r = this.r;
    const gen = ++this.panelGen;
    const sms = safeArr<string>(r.stateMachineNames);
    if (!sms.length) {
      this.set({ inputs: { gen, count: "0", model: { kind: "noStateMachine" } } });
      return;
    }
    const target = this.currentSM || sms[0];
    let inputs: any[] = [];
    try {
      inputs = r.stateMachineInputs(target) || [];
    } catch {
      /* ignore */
    }
    if (!inputs.length) {
      this.set({ inputs: { gen, count: "0", model: { kind: "noInputs", target, dataBinding: hasDataBinding(r) } } });
      return;
    }
    const T = R.StateMachineInputType;
    const rows: InputRow[] = [];
    let n = 0;
    inputs.forEach((inp) => {
      n++;
      if (inp.type === T.Trigger) rows.push({ kind: "trigger", name: inp.name, input: inp });
      else if (inp.type === T.Boolean) rows.push({ kind: "boolean", name: inp.name, input: inp });
      else if (inp.type === T.Number) rows.push({ kind: "number", name: inp.name, input: inp });
    });
    this.set({ inputs: { gen, count: String(n), model: { kind: "list", rows } } });
  }

  private buildDataPanel(): void {
    const r = this.r;
    if (!r) return;
    const gen = ++this.panelGen;
    let vms = listViewModels(r);
    let defVM: any = null;
    try {
      defVM = r.defaultViewModel ? r.defaultViewModel() : null;
    } catch {
      /* ignore */
    }
    if (!vms.length && defVM) vms = [defVM];
    if (!vms.length) {
      this.set({ data: { gen, count: "0", model: { kind: "none" } } });
      return;
    }
    const count = String(vms.length) + (vms.length === 1 ? " VM" : " VMs");

    if (this.dbVMName == null) this.dbVMName = defVM ? defVM.name : vms[0].name;
    const selVM = vmByName(r, this.dbVMName) || vms[0];
    const instNames = instanceNamesOf(selVM);

    // ----- resolve the active instance -----
    let vmi: any = null;
    if (this.dbInstName) {
      try {
        vmi = selVM.instanceByName(this.dbInstName);
      } catch {
        /* ignore */
      }
      if (vmi) {
        try {
          if (r.bindViewModelInstance) r.bindViewModelInstance(vmi);
          log("sys", "[bind]", selVM.name + " ← instance “" + this.dbInstName + "”");
        } catch {
          /* ignore */
        }
      }
    } else {
      // default/bound: prefer the auto-bound instance when it's the default VM
      if (defVM && selVM.name === defVM.name) {
        try {
          vmi = r.viewModelInstance;
        } catch {
          /* ignore */
        }
      }
      if (!vmi) {
        try {
          vmi = selVM.defaultInstance ? selVM.defaultInstance() : selVM.instance ? selVM.instance() : null;
        } catch {
          /* ignore */
        }
        if (vmi) {
          try {
            if (r.bindViewModelInstance) r.bindViewModelInstance(vmi);
          } catch {
            /* ignore */
          }
        }
      }
    }

    let body: Extract<DataModel, { kind: "vm" }>["body"];
    if (!vmi) body = { kind: "unresolved", vmName: selVM.name };
    else {
      const counter = { n: 0 };
      const nodes = this.collectVMProps(selVM, vmi, counter, 0);
      body = counter.n === 0 ? { kind: "empty", vmName: selVM.name } : { kind: "props", nodes };
    }

    this.set({
      data: {
        gen,
        count,
        model: {
          kind: "vm",
          vmName: selVM.name,
          vmNames: vms.length > 1 ? vms.map((v) => v.name) : null,
          instanceNames: instNames.length ? instNames : null,
          selectedInstance: this.dbInstName,
          body,
        },
      },
    });
  }

  private collectVMProps(vm: any, vmi: any, counter: { n: number }, depth: number): DataNode[] {
    const R = this.R!;
    const out: DataNode[] = [];
    getVMProps(vm).forEach((p) => {
      const name = p.name;
      const type = mapType(R, p.type);
      try {
        if (type === "number" || type === "string" || type === "boolean" || type === "color" || type === "trigger") {
          const prop = vmi[type](name);
          if (!prop) return;
          out.push({ kind: type, name, prop } as DataNode);
          counter.n++;
        } else if (type === "enum") {
          const prop = vmi.enum(name);
          if (!prop) return;
          let values: string[] = [];
          try {
            values = prop.values || [];
          } catch {
            /* ignore */
          }
          out.push({ kind: "enum", name, prop, values });
          counter.n++;
        } else if (type === "nested" && depth < 3) {
          let child: any = null;
          try {
            child = vmi.viewModel(name);
          } catch {
            /* ignore */
          }
          const childVM = resolveChildVM(R, this.r, child);
          out.push({
            kind: "nested",
            name,
            children: child && childVM ? this.collectVMProps(childVM, child, counter, depth + 1) : null,
          });
        } else if (type === "list") {
          let lp: any = null;
          try {
            lp = vmi.list(name);
          } catch {
            /* ignore */
          }
          const len = lp ? (lp.length != null ? lp.length : "?") : "?";
          out.push({ kind: "list", name, text: "list · " + len + " item(s)" });
          counter.n++;
        } else if (type === "image") {
          out.push({ kind: "image", name, vmi });
          counter.n++;
        } else {
          out.push({ kind: "readonly", name, text: String(type), type: "readonly" });
          counter.n++;
        }
      } catch {
        /* ignore */
      }
    });
    return out;
  }

  selectViewModel = (name: string): void => {
    this.dbVMName = name;
    this.dbInstName = null;
    this.buildDataPanel();
  };

  selectInstance = (name: string): void => {
    this.dbInstName = name || null;
    this.buildDataPanel();
  };

  // ------------------------------------------------------------ structure / playback / layout

  selectArtboard = (name: string): void => {
    this.currentArtboard = name;
    this.currentSM = null;
    this.set({ artboard: name });
    this.instantiate({ artboard: name });
  };

  selectStateMachine = (name: string): void => {
    this.currentSM = name;
    this.set({ stateMachine: name });
    this.instantiate({ artboard: this.currentArtboard || undefined, stateMachine: name });
    this.set({ stateText: "state: —" });
  };

  selectAnimation = (name: string): void => {
    try {
      this.r.stop();
      this.r.play(name);
    } catch {
      /* ignore */
    }
  };

  play = (): void => {
    try {
      if (this.currentSM) this.r.play(this.currentSM);
      else this.r.play();
    } catch {
      /* ignore */
    }
  };

  pause = (): void => {
    try {
      this.r.pause();
    } catch {
      /* ignore */
    }
  };

  stop = (): void => {
    try {
      this.r.stop();
    } catch {
      /* ignore */
    }
  };

  reset = (): void => {
    this.instantiate({ artboard: this.currentArtboard || undefined, stateMachine: this.currentSM || undefined });
    log("sys", "[reset]", this.currentSM || "artboard");
  };

  setLayout = (fit: string, align: string): void => {
    this.lastFit = fit;
    this.lastAlign = align;
    this.set({ fit, align });
    const R = this.R;
    if (this.r && R) {
      try {
        this.r.layout = new R.Layout({ fit: (R.Fit as any)[fit], alignment: (R.Alignment as any)[align] });
        this.r.resizeDrawingSurfaceToCanvas();
      } catch {
        /* ignore */
      }
    }
  };

  setBackground = (bg: Background): void => this.set({ background: bg });

  // ------------------------------------------------------------ report

  copyReport = (): void => {
    const txt = this.R
      ? buildReport({ R: this.R, r: this.r, fileMeta: this.fileMeta, currentArtboard: this.currentArtboard, currentSM: this.currentSM })
      : "No file loaded.";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(
        () => log("sys", "[report]", "copied to clipboard"),
        () => fallbackCopy(txt),
      );
    } else fallbackCopy(txt);
  };

  // ------------------------------------------------------------ image props

  setImageFromUrl = (vmi: any, name: string, url: string): void => {
    const R = this.R;
    if (!R) return;
    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((buf) => R.decodeImage(new Uint8Array(buf)))
      .then((img: any) => {
        const ip = vmi.image(name);
        ip.value = img;
        if (img && img.unref) img.unref();
        log("sys", "[image]", "set " + name + " ← " + url);
      })
      .catch((e) => log("err", "[error]", "image load failed: " + e));
  };
}

function fallbackCopy(txt: string): void {
  const ta = document.createElement("textarea");
  ta.value = txt;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    log("sys", "[report]", "copied to clipboard");
  } catch {
    log("err", "[error]", "copy failed — see console");
    console.log(txt);
  }
  document.body.removeChild(ta);
}
