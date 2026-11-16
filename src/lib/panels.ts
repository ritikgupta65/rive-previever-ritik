/* eslint-disable @typescript-eslint/no-explicit-any */
// Plain-data models for the right-hand panels. The controller builds these
// imperatively (exactly when the original HTML tool rebuilt its DOM), and
// React components render them.

export type InputRow =
  | { kind: "trigger"; name: string; input: any }
  | { kind: "boolean"; name: string; input: any }
  | { kind: "number"; name: string; input: any };

export type InputsModel =
  | { kind: "initial" }
  | { kind: "noStateMachine" }
  | { kind: "noInputs"; target: string; dataBinding: boolean }
  | { kind: "list"; rows: InputRow[] };

export type DataNode =
  | { kind: "number"; name: string; prop: any }
  | { kind: "string"; name: string; prop: any }
  | { kind: "boolean"; name: string; prop: any }
  | { kind: "color"; name: string; prop: any }
  | { kind: "enum"; name: string; prop: any; values: string[] }
  | { kind: "trigger"; name: string; prop: any }
  | { kind: "nested"; name: string; children: DataNode[] | null }
  | { kind: "list"; name: string; text: string }
  | { kind: "image"; name: string; vmi: any }
  | { kind: "readonly"; name: string; text: string; type: string };

export type DataBody =
  | { kind: "unresolved"; vmName: string }
  | { kind: "empty"; vmName: string }
  | { kind: "props"; nodes: DataNode[] };

export type DataModel =
  | { kind: "initial" }
  | { kind: "none" }
  | {
      kind: "vm";
      vmName: string;
      /** Present only when there is more than one view model. */
      vmNames: string[] | null;
      /** Present only when the selected view model has named instances. */
      instanceNames: string[] | null;
      selectedInstance: string | null;
      body: DataBody;
    };

export interface PanelState<T> {
  /** Bumped on every rebuild so rows remount (and re-subscribe) like the original DOM rebuild. */
  gen: number;
  count: string;
  model: T;
}
