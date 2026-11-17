"use client";

import { useController } from "./PreviewerContext";

interface HeaderProps {
  logoRef: React.Ref<HTMLImageElement>;
  fileInputRef: React.Ref<HTMLInputElement>;
}

/** Top bar: only the pop logo, centered. The file picker input lives here so every "Open" button can reach it. */
export default function Header({ logoRef, fileInputRef }: HeaderProps) {
  const c = useController();

  return (
    <header>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="pop-logo" ref={logoRef} src="/images/pop.svg" alt="pop" />
      <input
        type="file"
        id="fileInput"
        accept=".riv"
        hidden
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) c.loadFile(f);
        }}
      />
    </header>
  );
}
