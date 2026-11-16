/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribe to a Rive view-model property and get its value on every change.
 * Unsubscribes on unmount (rows remount whenever a panel is rebuilt).
 */
export function usePropObserver(prop: any, onValue: (value: any) => void): void {
  const cbRef = useRef(onValue);
  useEffect(() => {
    cbRef.current = onValue;
  });
  useEffect(() => {
    if (!prop || typeof prop.on !== "function") return;
    const handler = () => {
      try {
        cbRef.current(prop.value);
      } catch {
        /* ignore */
      }
    };
    let un: unknown;
    try {
      un = prop.on(handler);
    } catch {
      return;
    }
    return () => {
      try {
        if (typeof un === "function") un();
        else if (typeof prop.off === "function") prop.off(handler);
      } catch {
        /* runtime may already be cleaned up */
      }
    };
  }, [prop]);
}
