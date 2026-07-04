export type RGB = {
  r: number;
  g: number;
  b: number;
};

export function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function srgbToLinearChannel(value: number): number {
  const normalized = value / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return ((normalized + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgbChannel(value: number): number {
  const clamped = clamp(value);
  const srgb =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(clamp(srgb) * 255);
}

export function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;

  values.sort((a, b) => a - b);
  const index = clamp(percentileValue / 100) * (values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return values[lower];
  }

  const ratio = index - lower;
  return values[lower] * (1 - ratio) + values[upper] * ratio;
}

export function percentileFromArray(
  values: Float32Array,
  percentileValue: number,
): number {
  if (values.length === 0) return 0;

  const maxSamples = 260000;
  const stride = Math.max(1, Math.ceil(values.length / maxSamples));
  const sampleCount = Math.ceil(values.length / stride);
  const sorted = new Array<number>(sampleCount);

  for (let index = 0, sampleIndex = 0; index < values.length; index += stride, sampleIndex += 1) {
    sorted[sampleIndex] = values[index];
  }

  return percentile(sorted, percentileValue);
}

export function safeGain(value: number, min = 0.6, max = 1.6): number {
  if (!Number.isFinite(value)) return 1;
  return clamp(value, min, max);
}
