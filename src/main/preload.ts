import { contextBridge, ipcRenderer } from 'electron';

import type {
  ConvertRequest,
  DetectRequest,
  DetectResponse,
  ImageInfo,
  ModelProgressEvent,
  ProcessRequest,
  RemoveObjectRequest,
  SegmentSelectionRequest,
  SegmentSelectionResponse,
} from './types';

const api = {
  selectFile: () => ipcRenderer.invoke('dialog:pick-image') as Promise<string | null>,
  getImageInfo: (filePath: string) => ipcRenderer.invoke('image:get-info', filePath) as Promise<ImageInfo>,
  convertImage: (request: ConvertRequest) => ipcRenderer.invoke('image:convert', request) as Promise<ImageInfo>,
  removeBackground: (request: ProcessRequest) =>
    ipcRenderer.invoke('ai:remove-background', request) as Promise<ImageInfo>,
  upscale: (request: ProcessRequest) => ipcRenderer.invoke('ai:upscale', request) as Promise<ImageInfo>,
  enhanceImage: (request: ProcessRequest) =>
    ipcRenderer.invoke('ai:enhance-realworld', request) as Promise<ImageInfo>,
  detectObjects: (request: DetectRequest) => ipcRenderer.invoke('ai:detect', request) as Promise<DetectResponse>,
  segmentSelection: (request: SegmentSelectionRequest) =>
    ipcRenderer.invoke('ai:segment-selection', request) as Promise<SegmentSelectionResponse>,
  removeObject: (request: RemoveObjectRequest) => ipcRenderer.invoke('ai:remove-object', request) as Promise<ImageInfo>,
  extractSelection: (request: RemoveObjectRequest) =>
    ipcRenderer.invoke('ai:extract-selection', request) as Promise<ImageInfo>,
  openInFolder: (filePath: string) => ipcRenderer.invoke('file:reveal', filePath) as Promise<void>,
  onModelProgress: (callback: (event: ModelProgressEvent) => void) => {
    const listener = (_event: unknown, payload: ModelProgressEvent) => {
      callback(payload);
    };

    ipcRenderer.on('model:progress', listener);
    return () => {
      ipcRenderer.removeListener('model:progress', listener);
    };
  },
  onMenuAction: (callback: (action: string) => void) => {
    const uploadListener = () => callback('upload-image');
    const exportListener = () => callback('export-result');

    ipcRenderer.on('menu:upload-image', uploadListener);
    ipcRenderer.on('menu:export-result', exportListener);

    return () => {
      ipcRenderer.removeListener('menu:upload-image', uploadListener);
      ipcRenderer.removeListener('menu:export-result', exportListener);
    };
  },
};

contextBridge.exposeInMainWorld('innoPhoto', api);
