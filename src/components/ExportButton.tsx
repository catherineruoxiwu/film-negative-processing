import { Archive, Loader2 } from "lucide-react";
import type { ExportState } from "../types/imageTypes";

type ExportButtonProps = {
  canExport: boolean;
  exportState: ExportState;
  onExport: () => void;
};

export function ExportButton({ canExport, exportState, onExport }: ExportButtonProps) {
  return (
    <button
      className="button button-primary"
      type="button"
      onClick={onExport}
      disabled={!canExport || exportState.running}
    >
      {exportState.running ? <Loader2 className="spin" size={17} /> : <Archive size={17} />}
      <span>{exportState.running ? "Exporting" : "Export ZIP"}</span>
    </button>
  );
}
