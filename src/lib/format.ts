export function fmtBytes(b: number): string {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  return (b / 1048576).toFixed(2) + " MB";
}

export function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

export function safeArr<T = unknown>(a: unknown): T[] {
  return Array.isArray(a) ? (a as T[]) : [];
}

export function hex(r: number, g: number, b: number): string {
  const h = (x: number) => {
    const s = (x || 0).toString(16);
    return s.length < 2 ? "0" + s : s;
  };
  return "#" + h(r) + h(g) + h(b);
}

export function errMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
