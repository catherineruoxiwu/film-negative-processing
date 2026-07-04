import { percentile, type RGB, srgbToLinearChannel } from "./colorMath";
import type { OrangeSelection } from "../types/imageTypes";

export type OrangeMaskSource = "auto" | "auto-loose" | "manual" | "manual-seed" | "fallback";

export type OrangeMaskDebug = {
  base: RGB;
  source: OrangeMaskSource;
  sampleCount: number;
  searchRegion?: OrangeSelection;
};

const DEFAULT_ORANGE_BASE: RGB = {
  r: 0.78,
  g: 0.38,
  b: 0.16,
};

export function detectOrangeMask(imageData: ImageData, manualRegion?: OrangeSelection): RGB {
  return detectOrangeMaskWithDebug(imageData, manualRegion).base;
}

export function detectOrangeMaskWithDebug(
  imageData: ImageData,
  manualRegion?: OrangeSelection,
): OrangeMaskDebug {
  if (manualRegion && manualRegion.width > 0 && manualRegion.height > 0) {
    const manualBase = detectOrangeMaskFromRegion(imageData, manualRegion);

    if (manualBase) {
      return manualBase;
    }
  }

  return detectAutoOrangeMask(imageData);
}

function detectAutoOrangeMask(imageData: ImageData): OrangeMaskDebug {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 70000)));

  let candidates = collectCandidates(data, width, height, stride, false);
  let source: OrangeMaskSource = "auto";

  if (candidates.r.length < 200) {
    candidates = collectCandidates(data, width, height, stride, true);
    source = "auto-loose";
  }

  if (candidates.r.length < 50) {
    return {
      base: DEFAULT_ORANGE_BASE,
      source: "fallback",
      sampleCount: 0,
    };
  }

  return {
    base: {
      r: Math.max(percentile(candidates.r, 98), 0.02),
      g: Math.max(percentile(candidates.g, 98), 0.02),
      b: Math.max(percentile(candidates.b, 98), 0.02),
    },
    source,
    sampleCount: candidates.r.length,
  };
}

function detectOrangeMaskFromRegion(
  imageData: ImageData,
  region: OrangeSelection,
): OrangeMaskDebug | undefined {
  const { data, width, height } = imageData;
  const seedSamples = collectManualSamples(imageData, clampRegion(region), 1);

  if (seedSamples.r.length < 3) {
    return undefined;
  }

  const seed = {
    r: percentile(seedSamples.r, 55),
    g: percentile(seedSamples.g, 55),
    b: percentile(seedSamples.b, 55),
  };
  const seedBrightness = (seed.r + seed.g + seed.b) / 3;
  const searchRegion = buildManualSearchRegion(region, width, height);
  const searchSamples = collectManualSamples(imageData, searchRegion);
  const rValues: number[] = [];
  const gValues: number[] = [];
  const bValues: number[] = [];

  for (let index = 0; index < searchSamples.r.length; index += 1) {
    const r = searchSamples.r[index];
    const g = searchSamples.g[index];
    const b = searchSamples.b[index];
    const brightness = (r + g + b) / 3;
    const chromaDistance = getChromaDistance(seed, { r, g, b });
    const brightnessDistance = Math.abs(brightness - seedBrightness);
    const orangeLikeSeed = seed.r > seed.g * 0.95 && seed.g > seed.b * 0.82;
    const plausibleBaseColor = !orangeLikeSeed || (r > g * 0.88 && g > b * 0.76);

    if (chromaDistance > 0.11 || brightnessDistance > 0.28 || !plausibleBaseColor) {
      continue;
    }

    rValues.push(r);
    gValues.push(g);
    bValues.push(b);
  }

  const sourceValues =
    rValues.length >= Math.max(12, seedSamples.r.length * 0.5)
      ? { r: rValues, g: gValues, b: bValues }
      : seedSamples;

  if (sourceValues.r.length < 3) {
    return undefined;
  }

  return {
    base: {
      r: Math.max(percentile(sourceValues.r, 58), 0.02),
      g: Math.max(percentile(sourceValues.g, 58), 0.02),
      b: Math.max(percentile(sourceValues.b, 58), 0.02),
    },
    source: sourceValues === seedSamples ? "manual-seed" : "manual",
    sampleCount: sourceValues.r.length,
    searchRegion,
  };
}

function collectManualSamples(
  imageData: ImageData,
  region: OrangeSelection,
  forcedStride?: number,
) {
  const { data, width, height } = imageData;
  const left = Math.max(0, Math.floor(region.x * width));
  const top = Math.max(0, Math.floor(region.y * height));
  const right = Math.min(width, Math.ceil((region.x + region.width) * width));
  const bottom = Math.min(height, Math.ceil((region.y + region.height) * height));
  const regionPixels = Math.max((right - left) * (bottom - top), 1);
  const stride = forcedStride ?? Math.max(1, Math.floor(Math.sqrt(regionPixels / 45000)));
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

  return {
    r: rValues,
    g: gValues,
    b: bValues,
  };
}

function buildManualSearchRegion(
  region: OrangeSelection,
  imageWidth: number,
  imageHeight: number,
): OrangeSelection {
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;
  const minSearchWidth = Math.min(96 / imageWidth, 0.18);
  const minSearchHeight = Math.min(96 / imageHeight, 0.18);
  const searchWidth = Math.min(1, Math.max(region.width * 2.5, minSearchWidth));
  const searchHeight = Math.min(1, Math.max(region.height * 2.5, minSearchHeight));

  return {
    x: clamp(centerX - searchWidth / 2, 0, 1 - searchWidth),
    y: clamp(centerY - searchHeight / 2, 0, 1 - searchHeight),
    width: searchWidth,
    height: searchHeight,
  };
}

function clampRegion(region: OrangeSelection): OrangeSelection {
  const x = clamp(region.x);
  const y = clamp(region.y);
  const width = clamp(region.width, 0, 1 - x);
  const height = clamp(region.height, 0, 1 - y);

  return {
    x,
    y,
    width,
    height,
  };
}

function getChromaDistance(a: RGB, b: RGB): number {
  const aSum = Math.max(a.r + a.g + a.b, 0.000001);
  const bSum = Math.max(b.r + b.g + b.b, 0.000001);
  const ar = a.r / aSum;
  const ag = a.g / aSum;
  const br = b.r / bSum;
  const bg = b.g / bSum;

  return Math.hypot(ar - br, ag - bg);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
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
