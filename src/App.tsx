import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { ImagePlus, Loader2 } from "lucide-react";
import { ImagePreview } from "./components/ImagePreview";
import { SliderPanel } from "./components/SliderPanel";
import { ThumbnailStrip } from "./components/ThumbnailStrip";
import { TopBar } from "./components/TopBar";
import { convertNegative } from "./image/convertNegative";
import {
  fileToImageData,
  fileToImageSize,
  imageDataToBlob,
} from "./image/renderCanvas";
import {
  DEFAULT_PARAMS,
  type AdjustmentScope,
  type ConvertParams,
  type SliderKey,
} from "./types/params";
import type {
  ExportState,
  ImportedImage,
  OrangeSelection,
  PreviewMode,
} from "./types/imageTypes";

const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".heif"];
const PREVIEW_DEBOUNCE_MS = 70;
const PREVIEW_MAX_LONG_EDGE = 1000;
const MAX_CACHED_PREVIEWS = 8;
const EMPTY_EXPORT_STATE: ExportState = {
  running: false,
  current: 0,
  total: 0,
  message: "",
};

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<ImportedImage[]>([]);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const previewCacheRef = useRef<Map<string, ImageData>>(new Map());
  const [images, setImages] = useState<ImportedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [previewMode, setPreviewMode] = useState<PreviewMode>("positive");
  const [globalParams, setGlobalParams] = useState<ConvertParams>(DEFAULT_PARAMS);
  const [imageParams, setImageParams] = useState<Record<string, ConvertParams>>({});
  const [orangeSelections, setOrangeSelections] = useState<Record<string, OrangeSelection>>({});
  const [adjustmentScope, setAdjustmentScope] = useState<AdjustmentScope>("global");
  const [isPickingOrange, setIsPickingOrange] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [isPreviewProcessing, setIsPreviewProcessing] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [exportState, setExportState] = useState<ExportState>(EMPTY_EXPORT_STATE);

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedId),
    [images, selectedId],
  );
  const selectedIndex = selectedImage
    ? images.findIndex((image) => image.id === selectedImage.id)
    : 0;
  const selectedHasLocalAdjustments = Boolean(selectedId && imageParams[selectedId]);
  const effectiveSelectedParams =
    selectedId && imageParams[selectedId] ? imageParams[selectedId] : globalParams;
  const activeSliderParams =
    adjustmentScope === "single" && selectedId ? effectiveSelectedParams : globalParams;
  const selectedOrangeSelection = selectedId ? orangeSelections[selectedId] : undefined;
  const debouncedPreviewParams = useDebouncedValue(
    effectiveSelectedParams,
    PREVIEW_DEBOUNCE_MS,
  );

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.objectUrl));
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
      previewCacheRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!selectedImage || previewMode !== "positive") {
      setPreviewUrl((previousUrl) => {
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return undefined;
      });
      setPreviewError(undefined);
      setIsPreviewProcessing(false);
      return;
    }

    let cancelled = false;
    setIsPreviewProcessing(true);
    setPreviewError(undefined);

    getCachedPreviewImageData(selectedImage, previewCacheRef.current)
      .then((sourceImageData) => {
        if (cancelled) return undefined;
        const converted = convertNegative(sourceImageData, debouncedPreviewParams, {
          orangeRegion: selectedOrangeSelection,
        });
        return imageDataToBlob(converted, "image/jpeg", 0.9);
      })
      .then((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }

        setPreviewUrl((previousUrl) => {
          if (previousUrl) URL.revokeObjectURL(previousUrl);
          return url;
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewError("Could not process this image.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewProcessing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedImage, debouncedPreviewParams, previewMode, selectedOrangeSelection]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;

    const files = Array.from(fileList);
    const acceptedFiles = files.filter(isSupportedImageFile);
    const rejectedCount = files.length - acceptedFiles.length;

    if (acceptedFiles.length === 0) {
      if (rejectedCount > 0) {
        setNotice("Some files could not be loaded.");
      }
      return;
    }

    const imported = acceptedFiles.map<ImportedImage>((file, index) => ({
      id: `${Date.now()}-${index}-${file.name}`,
      file,
      name: file.name,
      objectUrl: URL.createObjectURL(file),
    }));

    setImages((previousImages) => [...previousImages, ...imported]);
    setSelectedId((previousId) => previousId ?? imported[0]?.id);
    setNotice(
      rejectedCount > 0
        ? "Some files could not be loaded."
        : acceptedFiles.length > 8
          ? "These images may take a while to process in your browser."
          : undefined,
    );

    void Promise.allSettled(
      imported.map(async (image) => {
        const size = await fileToImageSize(image.file);
        setImages((currentImages) =>
          currentImages.map((currentImage) =>
            currentImage.id === image.id
              ? { ...currentImage, width: size.width, height: size.height }
              : currentImage,
          ),
        );
      }),
    );

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateParam = (key: SliderKey, value: number) => {
    if (adjustmentScope === "single" && selectedId) {
      setImageParams((current) => ({
        ...current,
        [selectedId]: {
          ...(current[selectedId] ?? globalParams),
          [key]: value,
        },
      }));
      return;
    }

    setGlobalParams((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetActiveParamsToDefault = () => {
    if (adjustmentScope === "single" && selectedId) {
      setImageParams((current) => ({
        ...current,
        [selectedId]: DEFAULT_PARAMS,
      }));
      return;
    }

    setGlobalParams(DEFAULT_PARAMS);
  };

  const clearSelectedLocalParams = () => {
    if (!selectedId) return;

    setImageParams((current) => {
      const next = { ...current };
      delete next[selectedId];
      return next;
    });
  };

  const toggleOrangePicker = () => {
    if (!selectedId) return;

    setIsPickingOrange((current) => {
      const next = !current;

      if (next) {
        setPreviewMode("negative");
      }

      return next;
    });
  };

  const updateSelectedOrangeSelection = (selection: OrangeSelection) => {
    if (!selectedId) return;

    setOrangeSelections((current) => ({
      ...current,
      [selectedId]: selection,
    }));
    setIsPickingOrange(false);
    setPreviewMode("positive");
  };

  const clearSelectedOrangeSelection = () => {
    if (!selectedId) return;

    setOrangeSelections((current) => {
      const next = { ...current };
      delete next[selectedId];
      return next;
    });
  };

  const handleExport = async () => {
    if (images.length === 0 || exportState.running) return;

    setNotice(undefined);
    setExportState({
      running: true,
      current: 0,
      total: images.length,
      message: `Processing 1 / ${images.length}...`,
    });

    try {
      const exportJobs = images.map((image) => ({
        image,
        params: getEffectiveParamsForImage(image.id, globalParams, imageParams),
        orangeRegion: orangeSelections[image.id],
      }));

      const result =
        typeof Worker !== "undefined"
          ? await exportWithWorker(exportJobs, setExportState)
          : await exportOnMainThread(exportJobs, setExportState);

      downloadBlob(result.blob, "film-converted.zip");
      setNotice(
        result.failures.length > 0
          ? `${result.failures.length} image${result.failures.length === 1 ? "" : "s"} skipped during export.`
          : "Export ready.",
      );
    } catch {
      try {
        const exportJobs = images.map((image) => ({
          image,
          params: getEffectiveParamsForImage(image.id, globalParams, imageParams),
          orangeRegion: orangeSelections[image.id],
        }));
        const result = await exportOnMainThread(exportJobs, setExportState);
        downloadBlob(result.blob, "film-converted.zip");
        setNotice(
          result.failures.length > 0
            ? `${result.failures.length} image${result.failures.length === 1 ? "" : "s"} skipped during export.`
            : "Export ready.",
        );
      } catch {
        setNotice("Could not export these images.");
      }
    } finally {
      setExportState(EMPTY_EXPORT_STATE);
    }
  };

  const previewSrc =
    previewMode === "negative" ? selectedImage?.objectUrl : previewUrl ?? selectedImage?.objectUrl;

  return (
    <main className="app-shell">
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
        multiple
        onChange={(event) => void handleFiles(event.currentTarget.files)}
      />

      <TopBar
        canExport={images.length > 0}
        imageCount={images.length}
        exportState={exportState}
        onImportClick={handleImportClick}
        onExport={handleExport}
      />

      {notice ? <div className="notice-bar">{notice}</div> : null}
      {exportState.running ? (
        <div className="progress-bar" aria-live="polite">
          <span>{exportState.message}</span>
          <progress value={exportState.current} max={exportState.total || 1} />
        </div>
      ) : null}
      {exportState.running ? (
        <div className="processing-screen" role="status" aria-live="polite">
          <div className="processing-panel">
            <Loader2 className="spin" size={38} />
            <h2>Processing Photos</h2>
            <p>{exportState.message}</p>
            <progress value={exportState.current} max={exportState.total || 1} />
          </div>
        </div>
      ) : null}

      {images.length === 0 ? (
        <section className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <ImagePlus size={34} />
          </div>
          <h2>Import your phone-shot color negatives to start.</h2>
          <button className="button button-primary" type="button" onClick={handleImportClick}>
            <ImagePlus size={18} />
            <span>Import Photos</span>
          </button>
          <p>All image processing happens locally in your browser. Your photos are never uploaded.</p>
        </section>
      ) : (
        <div className="editor-layout">
          <div className="preview-column">
            <ImagePreview
              imageSrc={previewSrc}
              mode={previewMode}
              index={selectedIndex}
              total={images.length}
              isProcessing={previewMode === "positive" && isPreviewProcessing}
              isPickingOrange={isPickingOrange}
              orangeSelection={selectedOrangeSelection}
              error={previewMode === "positive" ? previewError : undefined}
              onModeChange={setPreviewMode}
              onToggleOrangePicker={toggleOrangePicker}
              onClearOrangeSelection={clearSelectedOrangeSelection}
              onOrangeSelectionChange={updateSelectedOrangeSelection}
            />
            <ThumbnailStrip
              images={images}
              selectedId={selectedId}
              mode={previewMode}
              onSelect={setSelectedId}
            />
          </div>
          <SliderPanel
            params={activeSliderParams}
            scope={adjustmentScope}
            canUseSingleScope={Boolean(selectedId)}
            hasLocalAdjustments={selectedHasLocalAdjustments}
            onChange={updateParam}
            onScopeChange={setAdjustmentScope}
            onResetToDefault={resetActiveParamsToDefault}
            onClearLocal={clearSelectedLocalParams}
          />
        </div>
      )}
    </main>
  );
}

function isSupportedImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

type ExportJob = {
  image: ImportedImage;
  params: ConvertParams;
  orangeRegion?: OrangeSelection;
};

async function exportWithWorker(
  jobs: ExportJob[],
  setExportState: (state: ExportState) => void,
): Promise<{ blob: Blob; failures: string[] }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./workers/batchWorker.ts", import.meta.url), {
      type: "module",
    });

    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as
        | { type: "progress"; current: number; total: number; message: string }
        | { type: "done"; blob: Blob; failures: string[] }
        | { type: "error"; message: string };

      if (data.type === "progress") {
        setExportState({
          running: true,
          current: data.current,
          total: data.total,
          message: data.message,
        });
      }

      if (data.type === "done") {
        worker.terminate();
        resolve({
          blob: data.blob,
          failures: data.failures,
        });
      }

      if (data.type === "error") {
        worker.terminate();
        reject(new Error(data.message));
      }
    };

    worker.onerror = () => {
      worker.terminate();
      reject(new Error("Worker export failed."));
    };

    worker.postMessage({
      type: "start",
      jobs: jobs.map((job) => ({
        file: job.image.file,
        params: job.params,
        orangeRegion: job.orangeRegion,
      })),
    });
  });
}

async function exportOnMainThread(
  jobs: ExportJob[],
  setExportState: (state: ExportState) => void,
): Promise<{ blob: Blob; failures: string[] }> {
  const zip = new JSZip();
  const failures: string[] = [];

  for (let index = 0; index < jobs.length; index += 1) {
    const { image, params, orangeRegion } = jobs[index];
    setExportState({
      running: true,
      current: index,
      total: jobs.length,
      message: `Processing ${index + 1} / ${jobs.length}...`,
    });

    try {
      const { imageData } = await fileToImageData(image.file);
      const converted = convertNegative(imageData, params, {
        orangeRegion,
      });
      const blob = await imageDataToBlob(converted, "image/jpeg", 0.92);
      zip.file(`film_${String(index + 1).padStart(3, "0")}.jpg`, blob);
    } catch {
      failures.push(image.name);
    }

    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  const blob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      setExportState({
        running: true,
        current: jobs.length,
        total: jobs.length,
        message: `Creating ZIP ${Math.round(metadata.percent)}%...`,
      });
    },
  );

  return {
    blob,
    failures,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getEffectiveParamsForImage(
  imageId: string,
  globalParams: ConvertParams,
  imageParams: Record<string, ConvertParams>,
): ConvertParams {
  return imageParams[imageId] ?? globalParams;
}

async function getCachedPreviewImageData(
  image: ImportedImage,
  cache: Map<string, ImageData>,
): Promise<ImageData> {
  const cached = cache.get(image.id);

  if (cached) {
    return cached;
  }

  const { imageData } = await fileToImageData(image.file, PREVIEW_MAX_LONG_EDGE);
  cache.set(image.id, imageData);

  if (cache.size > MAX_CACHED_PREVIEWS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) {
      cache.delete(oldestKey);
    }
  }

  return imageData;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debouncedValue;
}
