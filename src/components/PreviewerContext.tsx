"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { PreviewerController, PreviewerState } from "@/lib/controller";

export const PreviewerContext = createContext<PreviewerController | null>(null);

export function useController(): PreviewerController {
  const c = useContext(PreviewerContext);
  if (!c) throw new Error("useController must be used inside <PreviewerContext.Provider>");
  return c;
}

/** Subscribe to one slice of controller state; re-renders only when that slice changes. */
export function usePreviewerState<T>(selector: (s: PreviewerState) => T): T {
  const c = useController();
  return useSyncExternalStore(
    c.subscribe,
    () => selector(c.getSnapshot()),
    () => selector(c.getServerSnapshot()),
  );
}
