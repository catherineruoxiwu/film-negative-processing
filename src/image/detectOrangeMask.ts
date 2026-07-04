import { percentile, type RGB, srgbToLinearChannel } from "./colorMath";
import type { OrangeSelection } from "../types/imageTypes";

const DEFAULT_ORANGE_BASE: RGB = {
  r: 0.78,
  g: 0.38,
  b: 0.16,
};

export function detectOrangeMask(imageData: ImageData, manualRegion?: OrangeSelection): RGB {
  if (manualRegion && manualRegion.width > 0 && manualRegion.height > 0) {
    const manualBase = detectOrangeMaskFromRegion(imageData, manualRegion);

    if (manualBase) {
      return manualBase;
    }
  }

  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 70000)));

  let candidates = collectCandidates(data, width, height, stride, false);

  if (candidates.r.length < 200) {
    candidates = collectCandidates(data, width, height, stride, true);
  }

  if (candidates.r.length < 50) {
    return DEFAULT_ORANGE_BASE;
  }

  return {
    r: Math.max(percentile(candidates.r, 98), 0.02),
    g: Math.max(percentile(candidates.g, 98), 0.02),
    b: Math.max(percentile(candidates.b, 98), 0.02),
  };
}

function detectOrangeMaskFromRegion(
  imageData: ImageData,
  region: OrangeSelection,
): RGB | undefined {
  const { data, width, height } = imageData;
  const left = Math.max(0, Math.floor(region.x * width));
  const top = Math.max(0, Math.floor(region.y * height));
  const right = Math.min(width, Math.ceil((region.x + region.width) * width));
  const bottom = Math.min(height, Math.ceil((region.y + region.height) * height));
  const regionPixels = Math.max((right - left) * (bottom - top), 1);
  const stride = Math.max(1, Math.floor(Math.sqrt(regionPixels / 45000)));
  const rValues: number[] = [];
  const gValues: number[] = [];
  const bValues: number[] = [];

  for (let y = top; y < bottom; y += stride) {
    for (let x = left; x < right; x += stride) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] / 255;

      if (alpha < 0.5) continue;

      const r = srgbToLinearChannel(data[index]);
      const g = srgbToLinearChannel(data[index + 1]);
      const b = srgbToLinearChannel(data[index + 2]);
      const brightness = (r + g + b) / 3;

      if (brightness < 0.035 || brightness > 0.9) continue;

      rValues.push(r);
      gValues.push(g);
      bValues.push(b);
    }
  }

  if (rValues.length < 20) {
    return undefined;
  }

  return {
    r: Math.max(percentile(rValues, 80), 0.02),
    g: Math.max(percentile(gValues, 80), 0.02),
    b: Math.max(percentile(bValues, 80), 0.02),
  };
}

function collectCandidates(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  stride: number,
  loose: boolean,
) {
  const rValues: number[] = [];
  const gValues: number[] = [];
  const bValues: number[] = [];

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3] / 255;

      if (alpha < 0.5) continue;

      const r = srgbToLinearChannel(data[index]);
      const g = srgbToLinearChannel(data[index + 1]);
      const b = srgbToLinearChannel(data[index + 2]);
      const brightness = (r + g + b) / 3;

      const strictCandidate =
        r > 0.18 &&
        g > 0.06 &&
        b < 0.5 &&
        r > 1.04 * g &&
        g > 1.01 * b &&
        brightness > 0.08 &&
        brightness < 0.72;

      const looseCandidate =
        r > 0.08 &&
        g > 0.035 &&
        r > 1.01 * g &&
        g > 0.92 * b &&
        brightness > 0.04 &&
        brightness < 0.82;

      if (strictCandidate || (loose && looseCandidate)) {
        rValues.push(r);
        gValues.push(g);
        bValues.push(b);
      }
    }
  }

  return {
    r: rValues,
    g: gValues,
    b: bValues,
  };
}
