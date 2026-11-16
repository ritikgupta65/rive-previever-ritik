import DataPanel from "./DataPanel";
import InputsPanel from "./InputsPanel";

export default function RightPanel() {
  return (
    <div className="col right">
      <div className="scroll">
        <InputsPanel />
        <DataPanel />
      </div>
    </div>
  );
}
