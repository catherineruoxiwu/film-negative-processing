import { clamp, percentileFromArray } from "./colorMath";

export type ChannelLevels = {
  low: number;
  high: number;
};

export type RGBLevels = {
  r: ChannelLevels;
  g: ChannelLevels;
  b: ChannelLevels;
  contrast: number;
};

export function calculateLevels(
  rValues: Float32Array,
  gValues: Float32Array,
  bValues: Float32Array,
  blackPoint: number,
  range: number,
): RGBLevels {
  const normalizedRange = clamp(range / 50, -1, 1);
  const lowPercentile = clamp(
    blackPoint + Math.max(normalizedRange, 0) * 1.2 + Math.min(normalizedRange, 0) * 0.3,
    0,
    6,
  );
  const highPercentile = clamp(
    99.55 - Math.max(normalizedRange, 0) * 1.15 - Math.min(normalizedRange, 0) * 0.3,
    96,
    99.9,
  );

  return {
    r: getChannelLevels(rValues, lowPercentile, highPercentile),
    g: getChannelLevels(gValues, lowPercentile, highPercentile),
    b: getChannelLevels(bValues, lowPercentile, highPercentile),
    contrast: 1 + normalizedRange * 0.42,
  };
}

export function applyLevel(value: number, levels: ChannelLevels): number {
  const range = Math.max(levels.high - levels.low, 0.0001);
  return clamp((value - levels.low) / range);
}

function getChannelLevels(
  values: Float32Array,
  lowPercentile: number,
  highPercentile: number,
): ChannelLevels {
  const low = percentileFromArray(values, lowPercentile);
  const high = percentileFromArray(values, highPercentile);

  if (high - low < 0.0001) {
    return {
      low,
      high: low + 0.0001,
    };
  }

  return {
    low,
    high,
  };
}
