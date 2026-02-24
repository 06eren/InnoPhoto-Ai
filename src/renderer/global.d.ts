import type { InnoPhotoApi } from './types';

declare global {
  interface Window {
    innoPhoto: InnoPhotoApi;
  }
}

export {};
