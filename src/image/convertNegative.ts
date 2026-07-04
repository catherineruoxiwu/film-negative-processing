import { detectOrangeMask } from "./detectOrangeMask";
import {
  clamp,
  linearToSrgbChannel,
  safeGain,
  srgbToLinearChannel,
} from "./colorMath";
import { applyLevel, calculateLevels } from "./levels";
import type { ConvertParams } from "../types/params";
import type { OrangeSelection } from "../types/imageTypes";

const EPSILON = 0.000001;
const WHITE_BALANCE_STRENGTH = 0.22;

type ConvertOptions = {
  orangeRegion?: OrangeSelection;
};

export function convertNegative(
  imageData: ImageData,
  params: ConvertParams,
  options: ConvertOptions = {},
): ImageData {
  const { data, width, height } = imageData;
  const pixelCount = width * height;
  const base = detectOrangeMask(imageData, options.orangeRegion);
  const neutralBase = Math.max((base.r + base.g + base.b) / 3, EPSILON);
  const rBase = neutralBase * (base.r / neutralBase) ** params.orangeRemoval;
  const gBase = neutralBase * (base.g / neutralBase) ** params.orangeRemoval;
  const bBase = neutralBase * (base.b / neutralBase) ** params.orangeRemoval;

  const densityR = new Float32Array(pixelCount);
  const densityG = new Float32Array(pixelCount);
  const densityB = new Float32Array(pixelCount);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    const alpha = data[dataIndex + 3];

    if (alpha === 0) {
      densityR[pixelIndex] = 0;
      densityG[pixelIndex] = 0;
      densityB[pixelIndex] = 0;
      continue;
    }

    const r = srgbToLinearChannel(data[dataIndex]);
    const g = srgbToLinearChannel(data[dataIndex + 1]);
    const b = srgbToLinearChannel(data[dataIndex + 2]);

    densityR[pixelIndex] = Math.max(Math.log((rBase + EPSILON) / (r + EPSILON)), 0);
    densityG[pixelIndex] = Math.max(Math.log((gBase + EPSILON) / (g + EPSILON)), 0);
    densityB[pixelIndex] = Math.max(Math.log((bBase + EPSILON) / (b + EPSILON)), 0);
  }

  const levels = calculateLevels(
    densityR,
    densityG,
    densityB,
    params.blackPoint,
    params.range,
  );

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    if (data[dataIndex + 3] === 0) continue;

    const r = applyCreativeRange(applyLevel(densityR[pixelIndex], levels.r), levels.contrast);
    const g = applyCreativeRange(applyLevel(densityG[pixelIndex], levels.g), levels.contrast);
    const b = applyCreativeRange(applyLevel(densityB[pixelIndex], levels.b), levels.contrast);

    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  const meanR = count > 0 ? sumR / count : 0.5;
  const meanG = count > 0 ? sumG / count : 0.5;
  const meanB = count > 0 ? sumB / count : 0.5;
  const mean = Math.max((meanR + meanG + meanB) / 3, EPSILON);

  const wbR = safeGain((mean / Math.max(meanR, EPSILON)) ** WHITE_BALANCE_STRENGTH, 0.78, 1.28);
  const wbG = safeGain((mean / Math.max(meanG, EPSILON)) ** WHITE_BALANCE_STRENGTH, 0.78, 1.28);
  const wbB = safeGain((mean / Math.max(meanB, EPSILON)) ** WHITE_BALANCE_STRENGTH, 0.78, 1.28);

  const temperatureR = 1 + params.temperature * 0.004;
  const temperatureB = 1 - params.temperature * 0.004;
  const tintG = 1 - params.tint * 0.003;
  const exposureGain = 2 ** params.exposure;

  const output = new ImageData(width, height);

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    const dataIndex = pixelIndex * 4;
    const alpha = data[dataIndex + 3];

    if (alpha === 0) {
      output.data[dataIndex] = 0;
      output.data[dataIndex + 1] = 0;
      output.data[dataIndex + 2] = 0;
      output.data[dataIndex + 3] = 0;
      continue;
    }

    let r = applyCreativeRange(applyLevel(densityR[pixelIndex], levels.r), levels.contrast);
    let g = applyCreativeRange(applyLevel(densityG[pixelIndex], levels.g), levels.contrast);
    let b = applyCreativeRange(applyLevel(densityB[pixelIndex], levels.b), levels.contrast);

    r = clamp(r * wbR * temperatureR * exposureGain);
    g = clamp(g * wbG * tintG * exposureGain);
    b = clamp(b * wbB * temperatureB * exposureGain);

    output.data[dataIndex] = linearToSrgbChannel(r);
    output.data[dataIndex + 1] = linearToSrgbChannel(g);
    output.data[dataIndex + 2] = linearToSrgbChannel(b);
    output.data[dataIndex + 3] = alpha;
  }

  return output;
}

function applyCreativeRange(value: number, contrast: number): number {
  return clamp((value - 0.5) * contrast + 0.5);
}
