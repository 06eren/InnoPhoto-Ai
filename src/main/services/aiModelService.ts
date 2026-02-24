import path from 'node:path';
import { mkdir } from 'node:fs/promises';

import sharp from 'sharp';
import { RawImage } from '@huggingface/transformers';

import { WorkerManager } from './workerManager';
import type {
  Detection,
  EraseMode,
  ModelProgressEvent,
  SegmentSelectionResponse,
  SelectionBox,
} from '../types';

interface AIModelServiceOptions {
  outputDir: string;
  modelCacheDir: string;
  models?: {
    background?: string;
    upscale?: string;
    detection?: string;
    sam?: string;
    realworldEnhancer?: string;
  };
}

type ProgressCallback = (event: ModelProgressEvent) => void;

type RawImageLike = {
  width: number;
  height: number;
  channels: number;
  data: Uint8Array | Uint8ClampedArray;
  save: (path: string) => Promise<void>;
  rgba: () => RawImageLike;
  grayscale: () => RawImageLike;
  clone: () => RawImageLike;
  putAlpha: (mask: RawImageLike) => void;
};

const DEFAULT_MODELS = {
  background: 'Xenova/RMBG-2.0',
  upscale: 'Xenova/swin2SR-classical-sr-x2-64',
  detection: 'Xenova/detr-resnet-50',
  sam: 'Xenova/sam-vit-base',
  realworldEnhancer: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
};

export class AIModelService {
  private readonly backgroundModel: string;
  private readonly upscaleModel: string;
  private readonly realworldEnhancerModel: string;
  private readonly detectionModel: string;
  private readonly samModelId: string;
  private readonly workerManager: WorkerManager;

  constructor(private readonly options: AIModelServiceOptions) {
    this.backgroundModel = options.models?.background ?? DEFAULT_MODELS.background;
    this.upscaleModel = options.models?.upscale ?? DEFAULT_MODELS.upscale;
    this.realworldEnhancerModel = options.models?.realworldEnhancer ?? DEFAULT_MODELS.realworldEnhancer;
    this.detectionModel = options.models?.detection ?? DEFAULT_MODELS.detection;
    this.samModelId = options.models?.sam ?? DEFAULT_MODELS.sam;

    this.workerManager = new WorkerManager(options.modelCacheDir);
  }

  async removeBackground(inputPath: string, outputPath: string | undefined, progress?: ProgressCallback): Promise<string> {
    await this.ensureDirectories();
    if (progress) this.workerManager.setOnProgress(progress);

    const targetPath = outputPath ?? this.createOutputPath(inputPath, 'bg-removed', 'png');
    const source = (await RawImage.read(inputPath)) as unknown as RawImageLike;

    const output = await this.workerManager.runTask('remove-background', {
      inputPath,
      modelId: this.backgroundModel
    });

    const mask = this.extractMask(output);
    if (!mask) throw new Error('Background model output does not include a usable mask.');

    await this.saveWithMaskOrAlpha(source, mask, targetPath);
    return targetPath;
  }

  async upscale(inputPath: string, outputPath: string | undefined, progress?: ProgressCallback): Promise<string> {
    await this.ensureDirectories();
    if (progress) this.workerManager.setOnProgress(progress);

    const targetPath = outputPath ?? this.createOutputPath(inputPath, 'upscaled-x2', 'png');
    const output = await this.workerManager.runTask('upscale', { inputPath, modelId: this.upscaleModel });

    const image = this.unwrapRawImage(output);
    if (!image) throw new Error('Upscale model output is not a valid image.');

    await image.save(targetPath);
    return targetPath;
  }

  async enhanceRealWorld(inputPath: string, outputPath: string | undefined, progress?: ProgressCallback): Promise<string> {
    await this.ensureDirectories();
    if (progress) this.workerManager.setOnProgress(progress);

    const targetPath = outputPath ?? this.createOutputPath(inputPath, 'realworld-x4', 'png');
    const output = await this.workerManager.runTask('enhance-realworld', {
      inputPath,
      modelId: this.realworldEnhancerModel
    });

    const image = this.unwrapRawImage(output);
    if (!image) throw new Error('Realworld enhancer output is not a valid image.');

    await image.save(targetPath);
    return targetPath;
  }

  async detectObjects(inputPath: string, threshold: number, progress?: ProgressCallback): Promise<Detection[]> {
    if (progress) this.workerManager.setOnProgress(progress);
    const safeThreshold = Number.isFinite(threshold) ? Math.min(0.99, Math.max(0.1, threshold)) : 0.6;

    const output = await this.workerManager.runTask('detect', {
      inputPath,
      modelId: this.detectionModel,
      threshold: safeThreshold
    });

    if (!Array.isArray(output)) return [];

    return output
      .map((entry: any) => {
        const box = entry?.box ?? {};
        return {
          label: typeof entry?.label === 'string' ? entry.label : 'unknown',
          score: typeof entry?.score === 'number' ? entry.score : 0,
          box: {
            xmin: this.toFiniteNumber(box.xmin),
            ymin: this.toFiniteNumber(box.ymin),
            xmax: this.toFiniteNumber(box.xmax),
            ymax: this.toFiniteNumber(box.ymax),
          },
        } as Detection;
      })
      .filter((entry) => entry.score > 0);
  }

  async segmentSelection(
    inputPath: string,
    selectionBox: SelectionBox,
    progress?: ProgressCallback,
  ): Promise<SegmentSelectionResponse> {
    await this.ensureDirectories();
    if (progress) this.workerManager.setOnProgress(progress);

    const { mask, areaPixels, coverageRatio } = await this.generateSelectionMask(inputPath, selectionBox, progress);
    const maskPath = this.createOutputPath(inputPath, 'sam-mask', 'png');
    await mask.save(maskPath);

    return {
      maskPath,
      areaPixels,
      coverageRatio,
    };
  }

  async removeObject(
    inputPath: string,
    selectionBox: SelectionBox,
    eraseMode: EraseMode,
    outputPath: string | undefined,
    progress?: ProgressCallback,
  ): Promise<string> {
    await this.ensureDirectories();
    if (progress) this.workerManager.setOnProgress(progress);

    const { mask, areaPixels } = await this.generateSelectionMask(inputPath, selectionBox, progress);
    if (areaPixels <= 0) {
      throw new Error('The selected area did not produce a valid mask. Try a tighter selection box.');
    }

    const targetPath = outputPath ?? this.createOutputPath(inputPath, `object-removed-${eraseMode}`, 'png');

    if (eraseMode === 'transparent') {
      const source = ((await RawImage.read(inputPath)) as unknown as RawImageLike).rgba();
      const alpha = new Uint8ClampedArray(source.width * source.height);

      for (let index = 0; index < alpha.length; index += 1) {
        alpha[index] = mask.data[index] > 0 ? 0 : 255;
      }

      const keepMask = new RawImage(alpha, source.width, source.height, 1) as unknown as RawImageLike;
      source.putAlpha(keepMask);
      await source.save(targetPath);
      return targetPath;
    }

    const source = ((await RawImage.read(inputPath)) as unknown as RawImageLike).rgba();

    // Create a blurred version for fill-in
    const blurredBuffer = await sharp(inputPath)
      .ensureAlpha()
      .blur(24) // Increased blur for better coverage
      .raw()
      .toBuffer({ resolveWithObject: true });

    if (blurredBuffer.info.width !== source.width || blurredBuffer.info.height !== source.height) {
      throw new Error('Blur pre-processing failure.');
    }

    // Advanced blending: Feather the mask edges to avoid harsh lines
    // 1. Create a soft mask using sharp
    const maskBuffer = Buffer.from(mask.data);
    const softMask = await sharp(maskBuffer, {
      raw: { width: mask.width, height: mask.height, channels: 1 }
    })
      .blur(8) // Feather the mask itself
      .raw()
      .toBuffer();

    const resultData = new Uint8ClampedArray(source.data.length);
    const blurredData = blurredBuffer.data;

    for (let i = 0; i < mask.width * mask.height; i++) {
      const offset = i * 4;
      const alpha = softMask[i] / 255; // 0 = source, 1 = blurred

      resultData[offset] = Math.round(source.data[offset] * (1 - alpha) + blurredData[offset] * alpha);
      resultData[offset + 1] = Math.round(source.data[offset + 1] * (1 - alpha) + blurredData[offset + 1] * alpha);
      resultData[offset + 2] = Math.round(source.data[offset + 2] * (1 - alpha) + blurredData[offset + 2] * alpha);
      resultData[offset + 3] = 255;
    }

    const result = new RawImage(resultData, source.width, source.height, 4) as unknown as RawImageLike;
    await result.save(targetPath);
    return targetPath;
  }

  async extractSelection(
    inputPath: string,
    selectionBox: SelectionBox,
    outputPath: string | undefined,
    progress?: ProgressCallback,
  ): Promise<string> {
    await this.ensureDirectories();
    if (progress) this.workerManager.setOnProgress(progress);

    const { mask, areaPixels } = await this.generateSelectionMask(inputPath, selectionBox, progress);
    if (areaPixels <= 0) {
      throw new Error('The selected area did not produce a valid mask.');
    }

    const targetPath = outputPath ?? this.createOutputPath(inputPath, 'extracted', 'png');
    const source = ((await RawImage.read(inputPath)) as unknown as RawImageLike).rgba();

    // Inverse mask: Keep only what's in the mask
    const alpha = new Uint8ClampedArray(source.width * source.height);
    for (let index = 0; index < alpha.length; index += 1) {
      alpha[index] = mask.data[index];
    }

    const alphaMask = new RawImage(alpha, source.width, source.height, 1) as unknown as RawImageLike;
    source.putAlpha(alphaMask);

    // Optional: Crop to selectionBox bounds to tighten the result
    // For now, we keep the original size but we could use sharp to trim transparent area
    await source.save(targetPath);
    return targetPath;
  }

  private async generateSelectionMask(
    inputPath: string,
    selectionBox: SelectionBox,
    progress?: ProgressCallback,
  ): Promise<{ mask: RawImageLike; areaPixels: number; coverageRatio: number }> {
    const image = (await RawImage.read(inputPath)) as unknown as RawImageLike;
    const boundedBox = this.clampSelectionBox(selectionBox, image.width, image.height);
    const { points, labels } = this.buildSelectionPrompts(boundedBox, image.width, image.height);

    if (progress) this.workerManager.setOnProgress(progress);
    const output = await this.workerManager.runTask('sam-segment', {
      inputPath,
      modelId: this.samModelId,
      points,
      labels
    });

    const bestMask = this.pickBestMask(output.masks, output.iou_scores);
    this.filterMaskOutsideBox(bestMask, boundedBox, 8);

    const areaPixels = this.countActivePixels(bestMask.data);
    const coverageRatio = areaPixels / Math.max(1, bestMask.width * bestMask.height);

    return { mask: bestMask, areaPixels, coverageRatio };
  }

  private async ensureDirectories(): Promise<void> {
    await mkdir(this.options.outputDir, { recursive: true });
    await mkdir(this.options.modelCacheDir, { recursive: true });
  }

  private createOutputPath(inputPath: string, tag: string, extension: string): string {
    const baseName = path.parse(inputPath).name;
    const timestamp = new Date().toISOString().replace(/[\-:.TZ]/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 6);
    return path.join(this.options.outputDir, `${baseName}-${tag}-${timestamp}-${suffix}.${extension}`);
  }

  private saveWithMaskOrAlpha(source: RawImageLike, output: RawImageLike, targetPath: string): Promise<void> {
    if (output.channels === 4) return output.save(targetPath);
    const mask = output.channels === 1 ? output : output.grayscale();
    const rgba = source.clone().rgba();
    rgba.putAlpha(mask);
    return rgba.save(targetPath);
  }

  private unwrapRawImage(value: unknown): RawImageLike | null {
    if (this.isRawImageLike(value)) return value;
    if (Array.isArray(value) && value.length > 0 && this.isRawImageLike(value[0])) return value[0];

    if (value && typeof value === 'object') {
      const obj = value as any;
      const candidate = obj.image || obj.mask || value;
      if (candidate.data && candidate.width && candidate.height) {
        return new RawImage(candidate.data, candidate.width, candidate.height, candidate.channels || 3) as unknown as RawImageLike;
      }
    }
    return null;
  }

  private extractMask(value: unknown): RawImageLike | null {
    const raw = this.unwrapRawImage(value);
    if (raw) return raw.channels === 1 ? raw : raw.grayscale();

    if (Array.isArray(value)) {
      // Find a mask in the array
      for (const item of value) {
        const m = this.extractMask(item);
        if (m) return m;
      }
    }
    return null;
  }

  private clampSelectionBox(box: SelectionBox, imageWidth: number, imageHeight: number): SelectionBox {
    const x1 = Math.max(0, Math.min(imageWidth - 1, Math.round(box.x)));
    const y1 = Math.max(0, Math.min(imageHeight - 1, Math.round(box.y)));
    const x2 = Math.max(x1 + 1, Math.min(imageWidth, Math.round(box.x + box.width)));
    const y2 = Math.max(y1 + 1, Math.min(imageHeight, Math.round(box.y + box.height)));

    return {
      x: x1,
      y: y1,
      width: Math.max(1, x2 - x1),
      height: Math.max(1, y2 - y1),
    };
  }

  private buildSelectionPrompts(box: SelectionBox, imageWidth: number, imageHeight: number): { points: number[][]; labels: number[] } {
    const { x, y, width, height } = box;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const positive: number[][] = [
      [cx, cy],
      [x + width * 0.25, y + height * 0.25],
      [x + width * 0.75, y + height * 0.25],
      [x + width * 0.25, y + height * 0.75],
      [x + width * 0.75, y + height * 0.75],
    ];

    const margin = Math.max(6, Math.round(Math.min(width, height) * 0.18));
    const negative: number[][] = [
      [x - margin, y - margin],
      [x + width + margin, y - margin],
      [x - margin, y + height + margin],
      [x + width + margin, y + height + margin],
    ];

    const points = [...positive, ...negative].map(([px, py]) => [
      Math.max(0, Math.min(imageWidth - 1, Math.round(px))),
      Math.max(0, Math.min(imageHeight - 1, Math.round(py))),
    ]);

    const labels = [...positive.map(() => 1), ...negative.map(() => 0)];
    return { points, labels };
  }

  private pickBestMask(masksData: any[], iouScores: any): RawImageLike {
    if (!masksData || masksData.length === 0) throw new Error('SAM did not return any masks.');

    const scores = iouScores.data;
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] > bestScore) {
        bestScore = scores[i];
        bestIndex = i;
      }
    }

    const { dims, data } = masksData[0]; // Assuming multidimensional or channel-first
    let h, w, c, offset = 0;

    if (dims.length === 4) { // [batch, channels, h, w]
      c = dims[1]; h = dims[2]; w = dims[3];
      offset = bestIndex * h * w;
    } else if (dims.length === 3) { // [channels, h, w]
      c = dims[0]; h = dims[1]; w = dims[2];
      offset = bestIndex * h * w;
    } else {
      throw new Error('Unsupported mask dimensions from worker');
    }

    const maskData = new Uint8ClampedArray(h * w);
    for (let i = 0; i < maskData.length; i++) {
      maskData[i] = data[offset + i] > 0 ? 255 : 0;
    }

    return new RawImage(maskData, w, h, 1) as unknown as RawImageLike;
  }

  private filterMaskOutsideBox(mask: RawImageLike, box: SelectionBox, padding: number): void {
    const { x, y, width, height } = box;
    const minX = Math.max(0, x - padding);
    const minY = Math.max(0, y - padding);
    const maxX = Math.min(mask.width, x + width + padding);
    const maxY = Math.min(mask.height, y + height + padding);

    for (let py = 0; py < mask.height; py++) {
      const inY = py >= minY && py < maxY;
      for (let px = 0; px < mask.width; px++) {
        if (!inY || px < minX || px >= maxX) {
          mask.data[py * mask.width + px] = 0;
        }
      }
    }
  }

  private countActivePixels(data: Uint8Array | Uint8ClampedArray): number {
    let count = 0;
    for (let i = 0; i < data.length; i++) if (data[i] > 0) count++;
    return count;
  }

  private isRawImageLike(v: any): v is RawImageLike {
    return v && typeof v.width === 'number' && v.save;
  }

  private toFiniteNumber(v: any): number {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }
}

