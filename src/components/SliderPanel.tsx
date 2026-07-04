import { RotateCcw, Trash2 } from "lucide-react";
import { linearToSrgbChannel } from "../image/colorMath";
import type { OrangeMaskDebug } from "../image/detectOrangeMask";
import {
  SLIDER_CONFIGS,
  areParamsDefault,
  type AdjustmentScope,
  type ConvertParams,
  type ExportMaxLongEdge,
  type SliderKey,
} from "../types/params";

type SliderPanelProps = {
  params: ConvertParams;
  scope: AdjustmentScope;
  canUseSingleScope: boolean;
  hasLocalAdjustments: boolean;
  exportMaxLongEdge: ExportMaxLongEdge;
  orangeDebug?: OrangeMaskDebug;
  onChange: (key: SliderKey, value: number) => void;
  onScopeChange: (scope: AdjustmentScope) => void;
  onExportMaxLongEdgeChange: (value: ExportMaxLongEdge) => void;
  onResetToDefault: () => void;
  onClearLocal: () => void;
};

export function SliderPanel({
  params,
  scope,
  canUseSingleScope,
  hasLocalAdjustments,
  exportMaxLongEdge,
  orangeDebug,
  onChange,
  onScopeChange,
  onExportMaxLongEdgeChange,
  onResetToDefault,
  onClearLocal,
}: SliderPanelProps) {
  const isDefault = areParamsDefault(params);
  const isSingle = scope === "single";

  return (
    <aside className="control-panel" aria-label="Conversion controls">
      <div className="panel-heading">
        <h2>Conversion</h2>
      </div>

      <div className="scope-switch" aria-label="Adjustment scope">
        <button
          type="button"
          className={scope === "global" ? "active" : ""}
          onClick={() => onScopeChange("global")}
        >
          All Photos
        </button>
        <button
          type="button"
          className={scope === "single" ? "active" : ""}
          onClick={() => onScopeChange("single")}
          disabled={!canUseSingleScope}
        >
          This Photo
        </button>
      </div>

      {isSingle || hasLocalAdjustments ? (
        <p className="scope-note">
          {isSingle
            ? hasLocalAdjustments
              ? "Current photo has its own adjustment values."
              : "Move any slider to create values for this photo only."
            : "Selected photo is using local values. Switch to This Photo to edit them."}
        </p>
      ) : null}

      <div className="slider-list">
        {SLIDER_CONFIGS.map((config) => (
          <label className="slider-row" key={config.key}>
            <span className="slider-meta">
              <span>{config.label}</span>
              <output>{config.format(params[config.key])}</output>
            </span>
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={params[config.key]}
              onChange={(event) => onChange(config.key, Number(event.currentTarget.value))}
            />
          </label>
        ))}
      </div>

      {orangeDebug ? <OrangeDebugReadout debug={orangeDebug} /> : null}

      <div className="export-settings">
        <label className="select-row">
          <span className="slider-meta">
            <span>Export Size</span>
          </span>
          <select
            value={exportMaxLongEdge ?? "original"}
            onChange={(event) => {
              onExportMaxLongEdgeChange(parseExportMaxLongEdge(event.currentTarget.value));
            }}
          >
            <option value="original">Original</option>
            <option value="6000">Long edge 6000px</option>
            <option value="4000">Long edge 4000px</option>
            <option value="2400">Long edge 2400px</option>
          </select>
        </label>
      </div>

      <button
        className="button button-secondary default-button"
        type="button"
        onClick={onResetToDefault}
        disabled={isDefault}
      >
        <RotateCcw size={17} />
        <span>Default Values</span>
      </button>

      <button
        className="button button-ghost reset-button"
        type="button"
        onClick={onClearLocal}
        disabled={!hasLocalAdjustments}
      >
        <Trash2 size={17} />
        <span>Clear Photo Adjust</span>
      </button>
    </aside>
  );
}

function parseExportMaxLongEdge(value: string): ExportMaxLongEdge {
  if (value === "6000") return 6000;
  if (value === "4000") return 4000;
  if (value === "2400") return 2400;
  return undefined;
}

function OrangeDebugReadout({ debug }: { debug: OrangeMaskDebug }) {
  const r = linearToSrgbChannel(debug.base.r);
  const g = linearToSrgbChannel(debug.base.g);
  const b = linearToSrgbChannel(debug.base.b);
  const hex = rgbToHex(r, g, b);
  const sourceLabel = getSourceLabel(debug.source);

  return (
    <div className="orange-debug">
      <span
        className="orange-debug-swatch"
        style={{ backgroundColor: `rgb(${r} ${g} ${b})` }}
        aria-hidden="true"
      />
      <div className="orange-debug-copy">
        <span>Orange Debug</span>
        <strong>{hex}</strong>
        <small>
          {sourceLabel} · {debug.sampleCount} sample{debug.sampleCount === 1 ? "" : "s"}
        </small>
      </div>
    </div>
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0").toUpperCase();
}

function getSourceLabel(source: OrangeMaskDebug["source"]): string {
  if (source === "manual") return "Manual refined";
  if (source === "manual-seed") return "Manual seed";
  if (source === "auto-loose") return "Auto loose";
  if (source === "fallback") return "Fallback";
  return "Auto";
}
