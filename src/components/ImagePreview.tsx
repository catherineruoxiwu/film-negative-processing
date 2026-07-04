import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { ImageIcon, Loader2, Pipette, X } from "lucide-react";
import type { OrangeSelection, PreviewMode } from "../types/imageTypes";

type ImagePreviewProps = {
  imageSrc?: string;
  mode: PreviewMode;
  index: number;
  total: number;
  isProcessing: boolean;
  isPickingOrange: boolean;
  orangeSelection?: OrangeSelection;
  error?: string;
  onModeChange: (mode: PreviewMode) => void;
  onToggleOrangePicker: () => void;
  onClearOrangeSelection: () => void;
  onOrangeSelectionChange: (selection: OrangeSelection) => void;
};

type ImageBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function ImagePreview({
  imageSrc,
  mode,
  index,
  total,
  isProcessing,
  isPickingOrange,
  orangeSelection,
  error,
  onModeChange,
  onToggleOrangePicker,
  onClearOrangeSelection,
  onOrangeSelectionChange,
}: ImagePreviewProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [imageBox, setImageBox] = useState<ImageBox>();
  const [draftSelection, setDraftSelection] = useState<OrangeSelection>();
  const activeSelection = draftSelection ?? orangeSelection;

  const updateImageBox = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;

    if (!frame || !image || !image.naturalWidth || !image.naturalHeight) {
      setImageBox(undefined);
      return;
    }

    const frameRect = frame.getBoundingClientRect();
    const frameRatio = frameRect.width / frameRect.height;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    let width = frameRect.width;
    let height = frameRect.height;
    let left = 0;
    let top = 0;

    if (frameRatio > imageRatio) {
      height = frameRect.height;
      width = height * imageRatio;
      left = (frameRect.width - width) / 2;
    } else {
      width = frameRect.width;
      height = width / imageRatio;
      top = (frameRect.height - height) / 2;
    }

    setImageBox({ left, top, width, height });
  }, []);

  useEffect(() => {
    updateImageBox();
  }, [imageSrc, updateImageBox]);

  useEffect(() => {
    const frame = frameRef.current;

    if (!frame || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateImageBox);
      return () => window.removeEventListener("resize", updateImageBox);
    }

    const observer = new ResizeObserver(updateImageBox);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [updateImageBox]);

  const getNormalizedPoint = (event: PointerEvent<HTMLDivElement>) => {
    const frame = frameRef.current;
    const box = imageBox;

    if (!frame || !box) return undefined;

    const rect = frame.getBoundingClientRect();
    const x = event.clientX - rect.left - box.left;
    const y = event.clientY - rect.top - box.top;

    if (x < 0 || y < 0 || x > box.width || y > box.height) {
      return undefined;
    }

    return {
      x: clamp(x / box.width),
      y: clamp(y / box.height),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!isPickingOrange || isProcessing) return;
    const point = getNormalizedPoint(event);

    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = point;
    setDraftSelection({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isPickingOrange || !dragStartRef.current) return;
    const point = getNormalizedPoint(event);

    if (!point) return;

    setDraftSelection(rectFromPoints(dragStartRef.current, point));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isPickingOrange || !dragStartRef.current) return;

    const point = getNormalizedPoint(event) ?? dragStartRef.current;
    const nextSelection = normalizeMinimumSelection(
      rectFromPoints(dragStartRef.current, point),
      point,
      imageBox,
    );

    dragStartRef.current = null;
    setDraftSelection(undefined);
    onOrangeSelectionChange(nextSelection);
  };

  const selectionStyle = getSelectionStyle(activeSelection, imageBox);

  return (
    <section className="preview-region" aria-label="Image preview">
      <div className="preview-toolbar">
        <div className="segmented-control" aria-label="Preview mode">
          <button
            type="button"
            className={mode === "negative" ? "active" : ""}
            onClick={() => onModeChange("negative")}
          >
            Negative
          </button>
          <button
            type="button"
            className={mode === "positive" ? "active" : ""}
            onClick={() => onModeChange("positive")}
          >
            Positive
          </button>
        </div>
        <div className="preview-actions">
          <button
            className={isPickingOrange ? "preview-tool active" : "preview-tool"}
            type="button"
            onClick={onToggleOrangePicker}
            disabled={!imageSrc || isProcessing}
            title="Pick orange film base"
            aria-pressed={isPickingOrange}
          >
            <Pipette size={16} />
            <span>{isPickingOrange ? "Picking" : "Pick Orange"}</span>
          </button>
          <button
            className="preview-tool icon-only"
            type="button"
            onClick={onClearOrangeSelection}
            disabled={!orangeSelection}
            title="Clear orange selection"
          >
            <X size={16} />
          </button>
          <span className="image-counter">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
      </div>

      <div
        ref={frameRef}
        className={isPickingOrange ? "preview-frame picking-orange" : "preview-frame"}
      >
        {imageSrc ? (
          <img ref={imageRef} src={imageSrc} alt={`${mode} preview`} onLoad={updateImageBox} />
        ) : (
          <div className="preview-placeholder">
            <ImageIcon size={32} />
          </div>
        )}

        {(isPickingOrange || activeSelection) && imageBox ? (
          <div
            className={isPickingOrange ? "orange-selection-layer active" : "orange-selection-layer"}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              dragStartRef.current = null;
              setDraftSelection(undefined);
            }}
          >
            {selectionStyle ? <div className="orange-selection-box" style={selectionStyle} /> : null}
          </div>
        ) : null}

        {(isProcessing || error) && (
          <div className="preview-overlay">
            {isProcessing ? <Loader2 className="spin" size={20} /> : null}
            <span>{error ?? "Processing preview"}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function rectFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): OrangeSelection {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function normalizeMinimumSelection(
  selection: OrangeSelection,
  center: { x: number; y: number },
  imageBox: ImageBox | undefined,
): OrangeSelection {
  const fallbackPixelSize = 8;
  const minWidth = imageBox ? fallbackPixelSize / imageBox.width : 0.01;
  const minHeight = imageBox ? fallbackPixelSize / imageBox.height : 0.01;

  if (selection.width >= minWidth && selection.height >= minHeight) {
    return selection;
  }

  const width = Math.min(minWidth, 1);
  const height = Math.min(minHeight, 1);

  return {
    x: clamp(center.x - width / 2, 0, 1 - width),
    y: clamp(center.y - height / 2, 0, 1 - height),
    width,
    height,
  };
}

function getSelectionStyle(
  selection: OrangeSelection | undefined,
  imageBox: ImageBox | undefined,
): CSSProperties | undefined {
  if (!selection || !imageBox) return undefined;

  return {
    left: imageBox.left + selection.x * imageBox.width,
    top: imageBox.top + selection.y * imageBox.height,
    width: Math.max(1, selection.width * imageBox.width),
    height: Math.max(1, selection.height * imageBox.height),
  };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
