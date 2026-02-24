export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'tiff' | 'bmp' | 'ico' | 'gif' | 'avif' | 'jp2' | 'svg' | 'heif';

export interface ImageInfo {
  path: string;
  name: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ConvertRequest {
  inputPath: string;
  format: OutputFormat;
  quality: number;
  outputPath?: string;
}

export interface ProcessRequest {
  inputPath: string;
  outputPath?: string;
}

export type EraseMode = 'transparent' | 'fill';

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SegmentSelectionRequest {
  inputPath: string;
  selectionBox: SelectionBox;
}

export interface SegmentSelectionResponse {
  maskPath: string;
  areaPixels: number;
  coverageRatio: number;
}

export interface RemoveObjectRequest extends SegmentSelectionRequest {
  eraseMode: EraseMode;
  outputPath?: string;
}

export interface DetectRequest {
  inputPath: string;
  threshold: number;
}

export interface Detection {
  label: string;
  score: number;
  box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

export interface DetectResponse {
  detections: Detection[];
  summary: string;
}

export interface ModelProgressEvent {
  modelId: string;
  status: string;
  progress: number | null;
  file?: string;
}
