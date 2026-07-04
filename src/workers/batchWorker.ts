/// <reference lib="webworker" />

import JSZip from "jszip";
import { convertNegative } from "../image/convertNegative";
import type { ConvertParams } from "../types/params";
import type { OrangeSelection } from "../types/imageTypes";

type StartMessage = {
  type: "start";
  jobs: ExportJob[];
};

type WorkerMessage = StartMessage;

type ExportJob = {
  file: File;
  params: ConvertParams;
  orangeRegion?: OrangeSelection;
};

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
  if (event.data.type !== "start") return;
  void exportBatch(event.data.jobs);
};

async function exportBatch(jobs: ExportJob[]) {
  try {
    if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
      throw new Error("Worker image processing is not available in this browser.");
    }

    const zip = new JSZip();
    const failures: string[] = [];

    for (let index = 0; index < jobs.length; index += 1) {
      const { file, params, orangeRegion } = jobs[index];
      worker.postMessage({
        type: "progress",
        current: index,
        total: jobs.length,
        message: `Processing ${index + 1} / ${jobs.length}...`,
      });

      try {
        const imageData = await fileToImageData(file);
        const converted = convertNegative(imageData, params, { orangeRegion });
        const blob = await imageDataToBlob(converted);
        zip.file(`film_${String(index + 1).padStart(3, "0")}.jpg`, blob);
      } catch {
        failures.push(file.name);
      }
    }

    const blob = await zip.generateAsync(
      {
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      },
      (metadata) => {
        worker.postMessage({
          type: "progress",
          current: jobs.length,
          total: jobs.length,
          message: `Creating ZIP ${Math.round(metadata.percent)}%...`,
        });
      },
    );

    worker.postMessage({
      type: "done",
      blob,
      failures,
    });
  } catch (error) {
    worker.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Export failed.",
    });
  }
}

async function fileToImageData(file: File): Promise<ImageData> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    bitmap.close();
    throw new Error("Canvas 2D is not available.");
  }

  context.drawImage(bitmap, 0, 0);
  const imageData = context.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();
  return imageData;
}

async function imageDataToBlob(imageData: ImageData): Promise<Blob> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D is not available.");
  }

  context.putImageData(imageData, 0, 0);
  return canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.92,
  });
}
