import { timestamp } from "./format";

export type LogKind = "state" | "event" | "trigger" | "sys" | "err";

export interface LogItem {
  id: number;
  kind: LogKind;
  tag: string;
  msg: string;
  t: string;
}

const MAX_ITEMS = 500;

/**
 * Event-console store. Kept outside React state so anything (Rive callbacks,
 * the console hook, the controller) can log without a component reference.
 * Notifications are deferred to a microtask so logging from inside a React
 * render (e.g. a React warning routed through console.error) never triggers a
 * synchronous state update during render.
 */
class LogStore {
  private items: LogItem[] = [];
  private listeners = new Set<() => void>();
  private nextId = 1;
  private scheduled = false;

  log = (kind: LogKind, tag: string, msg: string): void => {
    const next = this.items.concat({ id: this.nextId++, kind, tag, msg, t: timestamp() });
    this.items = next.length > MAX_ITEMS ? next.slice(next.length - MAX_ITEMS) : next;
    this.notify();
  };

  clear = (): void => {
    this.items = [];
    this.notify();
  };

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): LogItem[] => this.items;

  private notify(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.listeners.forEach((fn) => fn());
    });
  }
}

export const logStore = new LogStore();
export const log = logStore.log;

const EMPTY: LogItem[] = [];
export const getServerLogSnapshot = (): LogItem[] => EMPTY;

let consoleHooked = false;

/**
 * Mirror the Rive engine's own console errors/warnings into the event console,
 * so files that load but fail to render (e.g. missing script generators, bad
 * script assets, unsupported features) surface a visible reason instead of a
 * blank stage.
 */
export function hookConsole(): void {
  if (consoleHooked || typeof window === "undefined") return;
  consoleHooked = true;
  let busy = false;
  const join = (args: unknown[]): string => {
    try {
      return args
        .map((x) =>
          typeof x === "string" ? x : x && typeof x === "object" && "message" in x ? String((x as { message: unknown }).message) : String(x),
        )
        .join(" ");
    } catch {
      return "";
    }
  };
  (["error", "warn"] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      if (!busy) {
        busy = true;
        try {
          const m = join(args);
          if (m) log(level === "warn" ? "sys" : "err", level === "warn" ? "[engine warn]" : "[engine error]", m);
        } catch {
          /* ignore */
        } finally {
          busy = false;
        }
      }
      return orig(...args);
    };
  });
}
