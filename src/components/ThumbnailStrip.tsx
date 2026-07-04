import type { ImportedImage, PreviewMode } from "../types/imageTypes";

type ThumbnailStripProps = {
  images: ImportedImage[];
  selectedId?: string;
  mode: PreviewMode;
  onSelect: (id: string) => void;
};

export function ThumbnailStrip({
  images,
  selectedId,
  mode,
  onSelect,
}: ThumbnailStripProps) {
  return (
    <section className="thumbnail-strip" aria-label="Imported photos">
      {images.map((image, index) => (
        <button
          key={image.id}
          className={image.id === selectedId ? "thumbnail selected" : "thumbnail"}
          type="button"
          onClick={() => onSelect(image.id)}
          aria-label={`Photo ${index + 1}`}
        >
          <img src={image.objectUrl} alt="" />
          <span>{String(index + 1).padStart(2, "0")}</span>
        </button>
      ))}
      <div className="thumbnail-mode">{mode === "positive" ? "Processed preview" : "Original preview"}</div>
    </section>
  );
}
