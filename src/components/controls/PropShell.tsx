import type { ReactNode } from "react";

export default function PropShell({ name, type, children }: { name: string; type: string; children: ReactNode }) {
  return (
    <div className={"prop t-" + type} data-pname={name}>
      <div className="top">
        <span className="pname">{name}</span>
        <span className="ptype">{type}</span>
      </div>
      {children}
    </div>
  );
}
