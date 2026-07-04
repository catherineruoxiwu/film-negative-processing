import { convertNegative } from "./convertNegative";
import type { ConvertParams } from "../types/params";

export type ImageDataResult = {
  imageData: ImageData;
  width: number;
  height: number;
};

export async function fileToImageData(
  file: File,
  maxLongEdge?: number,
): Promise<ImageDataResult> {
  const source = await decodeImage(file);
  const scale =
    maxLongEdge && Math.max(source.width, source.height) > maxLongEdge
      ? maxLongEdge / Math.max(source.width, source.height)
      : 1;
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    closeSource(source);
    throw new Error("Canvas 2D is not available.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(source, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  closeSource(source);

  return {
    imageData,
    width,
    height,
  };
}

export async function fileToImageSize(file: File): Promise<{ width: number; height: number }> {
  const source = await decodeImage(file);
  const size = {
    width: source.width,
    height: source.height,
  };
  closeSource(source);
  return size;
}

export async function imageDataToBlob(
  imageData: ImageData,
  type = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D is not available.");
  }

  canvas.width = imageData.width;
  canvas.height = imageData.height;
  context.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );

  if (!blob) {
    throw new Error("Could not encode processed image.");
  }

  return blob;
}

export async function processFileForPreview(
  file: File,
  params: ConvertParams,
  maxLongEdge = 1200,
): Promise<string> {
  const { imageData } = await fileToImageData(file, maxLongEdge);
  const converted = convertNegative(imageData, params);
  const blob = await imageDataToBlob(converted, "image/jpeg", 0.92);
  return URL.createObjectURL(blob);
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
    } catch {
      // Fall through to the HTML image decoder for browser-specific formats.
    }
  }

  return loadHtmlImage(file);
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}.`));
    };
    image.src = url;
  });
}

function closeSource(source: ImageBitmap | HTMLImageElement) {
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
}
