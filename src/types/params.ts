export type ConvertParams = {
  orangeRemoval: number;
  exposure: number;
  range: number;
  blackPoint: number;
  temperature: number;
  tint: number;
};

export const DEFAULT_PARAMS: ConvertParams = {
  orangeRemoval: 1,
  exposure: 0,
  range: 0,
  blackPoint: 0.4,
  temperature: 0,
  tint: 0,
};

export type SliderKey = keyof ConvertParams;

export type AdjustmentScope = "global" | "single";

export type ExportMaxLongEdge = 6000 | 4000 | 2400 | undefined;

export type SliderConfig = {
  key: SliderKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
};

export const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: "orangeRemoval",
    label: "Orange Removal",
    min: 0,
    max: 2,
    step: 0.01,
    format: (value) => `${Math.round(value * 100)}%`,
  },
  {
    key: "exposure",
    label: "Exposure",
    min: -2,
    max: 2,
    step: 0.05,
    format: (value) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`,
  },
  {
    key: "range",
    label: "Range",
    min: -50,
    max: 50,
    step: 1,
    format: (value) => `${value > 0 ? "+" : ""}${Math.round(value)}`,
  },
  {
    key: "blackPoint",
    label: "Black Point",
    min: 0,
    max: 5,
    step: 0.1,
    format: (value) => value.toFixed(1),
  },
  {
    key: "temperature",
    label: "Temperature",
    min: -50,
    max: 50,
    step: 1,
    format: (value) => `${value > 0 ? "+" : ""}${Math.round(value)}`,
  },
  {
    key: "tint",
    label: "Tint",
    min: -50,
    max: 50,
    step: 1,
    format: (value) => `${value > 0 ? "+" : ""}${Math.round(value)}`,
  },
];

export function areParamsDefault(params: ConvertParams): boolean {
  return SLIDER_CONFIGS.every((config) => params[config.key] === DEFAULT_PARAMS[config.key]);
}
