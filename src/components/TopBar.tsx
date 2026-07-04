import { Upload } from "lucide-react";
import { ExportButton } from "./ExportButton";
import type { ExportState } from "../types/imageTypes";

type TopBarProps = {
  canExport: boolean;
  imageCount: number;
  exportState: ExportState;
  onImportClick: () => void;
  onExport: () => void;
};

export function TopBar({
  canExport,
  imageCount,
  exportState,
  onImportClick,
  onExport,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <h1>Film Converter</h1>
          <p>{imageCount > 0 ? `${imageCount} photo${imageCount === 1 ? "" : "s"}` : "Local browser processing"}</p>
        </div>
      </div>

      <div className="top-actions">
        <button className="button button-secondary" type="button" onClick={onImportClick}>
          <Upload size={17} />
          <span>Import Photos</span>
        </button>
        <ExportButton canExport={canExport} exportState={exportState} onExport={onExport} />
      </div>
    </header>
  );
}
