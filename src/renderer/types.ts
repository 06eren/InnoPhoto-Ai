export type OutputFormat = 'png' | 'jpeg' | 'webp' | 'tiff' | 'bmp' | 'ico' | 'gif' | 'avif' | 'jp2' | 'svg';

export interface ImageInfo {
  path: string;
  name: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface ModelProgressEvent {
  modelId: string;
  status: 'init' | 'download' | 'done' | 'progress' | string;
  progress?: number | null;
  file?: string;
}

export type EraseMode = 'fill' | 'transparent';

export interface ProcessRequest {
  inputPath: string;
  outputPath?: string;
  settings?: StudioSettings;
}

export interface DetectRequest {
  inputPath: string;
  threshold: number;
}

export interface DetectResponse {
  detections: Detection[];
  summary: string;
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

export interface RemoveObjectRequest {
  inputPath: string;
  selectionBox: SelectionBox;
  eraseMode: EraseMode;
  outputPath?: string;
}

export interface ConvertRequest {
  inputPath: string;
  format: OutputFormat;
  quality: number;
  outputPath?: string;
}

export interface StudioSettings {
  upscaleFactor: 2 | 4 | 8;
  upscaleMethod: 'classical' | 'realworld';
  detectionThreshold: number;
  detectionClasses: string[];
  sharpenLevel: number;
  outlineVisible: boolean;
  outlineColor: string;
  samMode: 'remove' | 'extract';
  targetFormat: OutputFormat;
  quality: number;
}

export type ToolId = 'remove-background' | 'upscale' | 'enhance' | 'object-detect' | 'object-remove' | 'convert';

export interface InnoPhotoApi {
  selectFile: () => Promise<string | null>;
  getImageInfo: (filePath: string) => Promise<ImageInfo>;
  convertImage: (request: ConvertRequest) => Promise<ImageInfo>;
  removeBackground: (request: ProcessRequest) => Promise<ImageInfo>;
  upscale: (request: ProcessRequest) => Promise<ImageInfo>;
  enhanceImage: (request: ProcessRequest) => Promise<ImageInfo>;
  detectObjects: (request: DetectRequest) => Promise<DetectResponse>;
  segmentSelection: (request: SegmentSelectionRequest) => Promise<SegmentSelectionResponse>;
  removeObject: (request: RemoveObjectRequest) => Promise<ImageInfo>;
  extractSelection: (request: SegmentSelectionRequest) => Promise<ImageInfo>;
  openInFolder: (filePath: string) => Promise<void>;
  onModelProgress: (callback: (event: ModelProgressEvent) => void) => () => void;
  onMenuAction: (callback: (action: string) => void) => () => void;
}
