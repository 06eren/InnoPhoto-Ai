import path from 'node:path';
import { mkdir, stat } from 'node:fs/promises';
import sharp from 'sharp';

import type { ConvertRequest, ImageInfo, OutputFormat } from '../types';

const DEFAULT_QUALITY = 92;

function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) {
    return DEFAULT_QUALITY;
  }
  return Math.min(100, Math.max(1, Math.round(quality)));
}

function extensionFromFormat(format: OutputFormat): string {
  switch (format) {
    case 'jpeg': return 'jpg';
    case 'tiff': return 'tiff';
    case 'heif': return 'heic';
    case 'avif': return 'avif';
    case 'jp2': return 'jp2';
    default: return format;
  }
}

export class ImageService {
  constructor(private readonly outputDir: string) { }

  async getImageInfo(filePath: string): Promise<ImageInfo> {
    const [metadata, fileStat] = await Promise.all([sharp(filePath).metadata(), stat(filePath)]);

    return {
      path: filePath,
      name: path.basename(filePath),
      width: metadata.width ?? 0,
      height: metadata.height ?? 0,
      format: ((metadata.format ?? path.extname(filePath).replace('.', '')) || 'unknown').toLowerCase(),
      size: fileStat.size,
    };
  }

  createOutputPath(inputPath: string, tag: string, extension: string): string {
    const baseName = path.parse(inputPath).name;
    const timestamp = new Date().toISOString().replace(/[\-:.TZ]/g, '').slice(0, 14);
    const suffix = Math.random().toString(36).slice(2, 6);
    return path.join(this.outputDir, `${baseName}-${tag}-${timestamp}-${suffix}.${extension}`);
  }

  async convertImage(request: ConvertRequest): Promise<ImageInfo> {
    await mkdir(this.outputDir, { recursive: true });

    const quality = clampQuality(request.quality);
    const extension = extensionFromFormat(request.format);
    const outputPath = request.outputPath ?? this.createOutputPath(request.inputPath, `converted-${request.format}`, extension);

    let transformer = sharp(request.inputPath, { failOn: 'none' });

    switch (request.format) {
      case 'jpeg':
        transformer = transformer.jpeg({ quality, mozjpeg: true });
        break;
      case 'webp':
        transformer = transformer.webp({ quality, effort: 6 });
        break;
      case 'png':
        transformer = transformer.png({ compressionLevel: 9, palette: true });
        break;
      case 'avif':
        transformer = transformer.avif({ quality, effort: 4 });
        break;
      case 'heif':
        transformer = transformer.heif({ quality, effort: 4 });
        break;
      case 'tiff':
        transformer = transformer.tiff({ quality, compression: 'lzw' });
        break;
      case 'gif':
        transformer = transformer.gif();
        break;
      case 'jp2':
        transformer = transformer.jp2({ quality, lossless: quality === 100 });
        break;
      default:
        // For svg and others, sharp might just copy or use default
        break;
    }

    await transformer.toFile(outputPath);
    return this.getImageInfo(outputPath);
  }
}
