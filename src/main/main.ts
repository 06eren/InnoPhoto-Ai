import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';

import { app, BrowserWindow, protocol, net } from 'electron';

import { registerIpcHandlers } from './ipc/registerHandlers';
import { AIModelService } from './services/aiModelService';
import { ImageService } from './services/imageService';

// Register local-file protocol early
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true } }
]);

let mainWindow: BrowserWindow | null = null;

async function createApp(): Promise<void> {
  const outputDir = path.join(app.getPath('pictures'), 'InnoPhoto-AI');
  const modelCacheDir = path.join(app.getAppPath(), 'models');

  await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(modelCacheDir, { recursive: true })]);

  // Handle local-file protocol using Extreme Robust Path Extraction (v6)
  protocol.handle('local-file', async (request) => {
    try {
      const { readFile } = await import('node:fs/promises');

      // 1. Get raw path from URL
      // "local-file:///E:/test.jpg" -> "E:/test.jpg"
      let rawPath = decodeURIComponent(request.url.replace(/^local-file:\/+/i, ''));

      // 2. Strip query parameters
      rawPath = rawPath.split('?')[0];

      // 3. Robust Windows Drive Letter Fix
      if (process.platform === 'win32') {
        // Remove ANY leading slashes (some systems send \e\... or /e/...)
        rawPath = rawPath.replace(/^[\\\/]+/, '');

        // Fix drive letters like "e/..." or "e\..." to "E:/..."
        if (/^[a-zA-Z][\\\/]/.test(rawPath)) {
          rawPath = rawPath.charAt(0).toUpperCase() + ':/' + rawPath.slice(2);
        } else if (/^[a-zA-Z]:/.test(rawPath)) {
          // Already has colon, just ensure uppercase and forward slashes
          rawPath = rawPath.charAt(0).toUpperCase() + rawPath.slice(1);
        }

        // 4. Remove trailing slashes and normalize
        // Windows open() fails if a file path ends with a slash
        rawPath = rawPath.replace(/[\\\/]+$/, '');
        rawPath = rawPath.replace(/\//g, path.sep); // Use \ for Windows, / for others
      }

      const filePath = path.normalize(rawPath);
      console.log(`[Protocol Handler] Raw URL: ${request.url}`);
      console.log(`[Protocol Handler] Final Path: "${filePath}"`);

      const buffer = await readFile(filePath);

      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif'
      };

      return new Response(buffer, {
        headers: {
          'Content-Type': mimeTypes[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      console.error('[Protocol Handler] Error reading file:', error);
      return new Response('File not found', { status: 404 });
    }
  });

  const imageService = new ImageService(outputDir);
  const aiModelService = new AIModelService({
    outputDir,
    modelCacheDir,
    models: {
      background: 'Xenova/RMBG-2.0',
      upscale: 'Xenova/swin2SR-classical-sr-x2-64',
      realworldEnhancer: 'Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',
      detection: 'Xenova/detr-resnet-50',
      sam: 'Xenova/sam-vit-base',
    },
  });

  registerIpcHandlers({ imageService, aiModelService });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: '#000000',
    title: 'InnoPhoto AI',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Temporary fix to allow local file loading
    },
  });

  setupMenu();

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

function setupMenu(): void {
  const isMac = process.platform === 'darwin';
  const { Menu, MenuItem, shell } = require('electron');

  const template: any[] = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Upload Image',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:upload-image')
        },
        { type: 'separator' },
        {
          label: 'Export Result',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:export-result')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/xenova/transformers.js');
          }
        },
        {
          label: 'InnoPhoto AI Studio',
          enabled: false
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createApp().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Application bootstrap failed:', error);
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createApp().catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Window recreation failed:', error);
      });
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

