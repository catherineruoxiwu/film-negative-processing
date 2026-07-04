export type ImportedImage = {
  id: string;
  file: File;
  name: string;
  objectUrl: string;
  width?: number;
  height?: number;
};

export type PreviewMode = "negative" | "positive";

export type OrangeSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExportState = {
  running: boolean;
  current: number;
  total: number;
  message: string;
};
