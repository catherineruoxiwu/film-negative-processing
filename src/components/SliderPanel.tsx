import { RotateCcw, Trash2 } from "lucide-react";
import {
  SLIDER_CONFIGS,
  areParamsDefault,
  type AdjustmentScope,
  type ConvertParams,
  type SliderKey,
} from "../types/params";

type SliderPanelProps = {
  params: ConvertParams;
  scope: AdjustmentScope;
  canUseSingleScope: boolean;
  hasLocalAdjustments: boolean;
  onChange: (key: SliderKey, value: number) => void;
  onScopeChange: (scope: AdjustmentScope) => void;
  onResetToDefault: () => void;
  onClearLocal: () => void;
};

export function SliderPanel({
  params,
  scope,
  canUseSingleScope,
  hasLocalAdjustments,
  onChange,
  onScopeChange,
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
