import { dialog, ipcMain, shell } from 'electron';

import type {
  DetectRequest,
  DetectResponse,
  ModelProgressEvent,
  ProcessRequest,
  RemoveObjectRequest,
  SegmentSelectionRequest,
  SegmentSelectionResponse,
} from '../types';
import type { AIModelService } from '../services/aiModelService';
import type { ImageService } from '../services/imageService';
import type { ConvertRequest } from '../types';

interface HandlerDependencies {
  imageService: ImageService;
  aiModelService: AIModelService;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'tif', 'tiff'];

export function registerIpcHandlers({ imageService, aiModelService }: HandlerDependencies): void {
  ipcMain.handle('dialog:pick-image', async () => {
    const response = await dialog.showOpenDialog({
      title: 'Select image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
    });

    if (response.canceled || response.filePaths.length === 0) {
      return null;
    }

    return response.filePaths[0];
  });

  ipcMain.handle('image:get-info', async (_event, filePath: string) => imageService.getImageInfo(filePath));

  ipcMain.handle('image:convert', async (_event, request: ConvertRequest) => imageService.convertImage(request));

  ipcMain.handle('ai:remove-background', async (event, request: ProcessRequest) => {
    const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
    const outputPath = await aiModelService.removeBackground(request.inputPath, request.outputPath, sendProgress);
    return imageService.getImageInfo(outputPath);
  });

  ipcMain.handle('ai:upscale', async (event, request: ProcessRequest) => {
    const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
    const outputPath = await aiModelService.upscale(request.inputPath, request.outputPath, sendProgress);
    return imageService.getImageInfo(outputPath);
  });

  ipcMain.handle('ai:enhance-realworld', async (event, request: ProcessRequest) => {
    const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
    const outputPath = await aiModelService.enhanceRealWorld(request.inputPath, request.outputPath, sendProgress);
    return imageService.getImageInfo(outputPath);
  });

  ipcMain.handle('ai:detect', async (event, request: DetectRequest): Promise<DetectResponse> => {
    const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
    const detections = await aiModelService.detectObjects(request.inputPath, request.threshold, sendProgress);

    const summary =
      detections.length > 0
        ? `${detections.length} object(s) detected with threshold ${request.threshold.toFixed(2)}`
        : 'No objects detected for the selected threshold.';

    return {
      detections,
      summary,
    };
  });

  ipcMain.handle(
    'ai:segment-selection',
    async (event, request: SegmentSelectionRequest): Promise<SegmentSelectionResponse> => {
      const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
      return aiModelService.segmentSelection(request.inputPath, request.selectionBox, sendProgress);
    },
  );

  ipcMain.handle('ai:remove-object', async (event, request: RemoveObjectRequest) => {
    const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
    const outputPath = await aiModelService.removeObject(
      request.inputPath,
      request.selectionBox,
      request.eraseMode,
      request.outputPath,
      sendProgress,
    );
    return imageService.getImageInfo(outputPath);
  });

  ipcMain.handle('ai:extract-selection', async (event, request: RemoveObjectRequest) => {
    const sendProgress = createProgressSender(event.sender.send.bind(event.sender));
    const outputPath = await aiModelService.extractSelection(
      request.inputPath,
      request.selectionBox,
      request.outputPath,
      sendProgress,
    );
    return imageService.getImageInfo(outputPath);
  });

  ipcMain.handle('file:reveal', async (_event, filePath: string) => {
    if (!filePath) {
      return;
    }
    shell.showItemInFolder(filePath);
  });
}

function createProgressSender(send: (channel: string, payload: ModelProgressEvent) => void) {
  return (event: ModelProgressEvent) => {
    send('model:progress', event);
  };
}
