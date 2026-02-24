import React, { useState, useRef, PointerEventHandler, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudioSettings, ImageInfo, Detection, ModelProgressEvent, ToolId } from './types';

// Components
import Sidebar from './components/Sidebar';
import Stage from './components/Stage';
import Gallery from './components/Gallery';
import LogModal from './components/LogModal';
import TopBar from './components/TopBar';

const DEFAULT_SETTINGS: StudioSettings = {
  upscaleFactor: 2,
  upscaleMethod: 'classical',
  detectionThreshold: 0.6,
  detectionClasses: ['person', 'car', 'dog', 'cat'],
  sharpenLevel: 30,
  outlineVisible: true,
  outlineColor: '#ffffff',
  samMode: 'remove',
  targetFormat: 'png',
  quality: 90
};

const App: React.FC = () => {
  // --- Global State ---
  const [gallery, setGallery] = useState<ImageInfo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<ToolId>('remove-background');
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);

  // UI State
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(true);
  const [logs, setLogs] = useState<{ id: string, msg: string, type: 'info' | 'success' | 'error' | 'warning', time: string }[]>([]);
  const [modelProgress, setModelProgress] = useState<Record<string, ModelProgressEvent>>({});

  // Selection / AI State
  const [draftBox, setDraftBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [activeMask, setActiveMask] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);

  // Refs
  const stageRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef({ active: false, startX: 0, startY: 0 });

  const currentImage = currentIndex >= 0 ? gallery[currentIndex] : null;

  // --- Utils ---
  const appendLog = useCallback((msg: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const time = new Date().toLocaleTimeString('tr-TR', { hour12: false });
    setLogs(prev => [{ id: Math.random().toString(36), msg, type, time }, ...prev].slice(0, 100));
  }, []);

  const toFileUrl = (path: string | null) => {
    if (!path) return '';
    const normalizedPath = path.replace(/\\/g, '/');
    return `local-file:///${normalizedPath}?nonce=${Date.now()}`;
  };

  // --- Core Handlers ---
  const handleFileUpload = async () => {
    try {
      const path = await window.innoPhoto.selectFile();
      if (!path) return;

      setBusy(true);
      const info = await window.innoPhoto.getImageInfo(path);
      setGallery(prev => [...prev, info]);
      setCurrentIndex(gallery.length); // Point to new item
      setActiveMask(null);
      setSelectionBox(null);
      appendLog(`Görsel galeriye eklendi: ${info.name}`, 'success');
    } catch (e: any) {
      appendLog(`Yükleme hatası: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFromGallery = (index: number) => {
    setGallery(prev => prev.filter((_, i) => i !== index));
    if (currentIndex >= index) {
      setCurrentIndex(Math.max(-1, currentIndex - 1));
      setActiveMask(null);
      setSelectionBox(null);
    }
  };

  const runOperation = async () => {
    if (!currentImage || busy) return;
    setBusy(true);
    setError(null);
    appendLog(`${operation} işlemi başlatıldı...`, 'info');

    try {
      let result: ImageInfo | null = null;
      switch (operation) {
        case 'remove-background':
          result = await window.innoPhoto.removeBackground({ inputPath: currentImage.path });
          break;
        case 'upscale':
          result = await window.innoPhoto.upscale({
            inputPath: currentImage.path,
            settings
          });
          break;
        case 'enhance':
          result = await window.innoPhoto.enhanceImage({
            inputPath: currentImage.path,
            settings
          });
          break;
        case 'object-detect':
          const detectRes = await window.innoPhoto.detectObjects({
            inputPath: currentImage.path,
            threshold: settings.detectionThreshold
          });
          setDetections(detectRes.detections);
          appendLog(detectRes.summary, 'success');
          break;
        case 'object-remove':
          if (!selectionBox) throw new Error('Silinecek alanı seçmelisiniz.');
          if (settings.samMode === 'extract') {
            result = await window.innoPhoto.extractSelection({
              inputPath: currentImage.path,
              selectionBox
            });
          } else {
            result = await window.innoPhoto.removeObject({
              inputPath: currentImage.path,
              selectionBox,
              eraseMode: 'fill'
            });
          }
          break;
        case 'convert':
          result = await window.innoPhoto.convertImage({
            inputPath: currentImage.path,
            format: settings.targetFormat,
            quality: settings.quality
          });
          break;
      }

      if (result) {
        setGallery(prev => [...prev, result!]);
        setCurrentIndex(gallery.length + 1);
        setActiveMask(null);
        setSelectionBox(null);
        appendLog(`İşlem tamamlandı, sonuç galeriye eklendi.`, 'success');
      }
    } catch (e: any) {
      setError(e.message);
      appendLog(`AI Hatası: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const runBatchOperation = async () => {
    if (gallery.length === 0) {
      appendLog('İşlenecek görsel yok.', 'error');
      return;
    }

    if (operation === 'object-remove' || operation === 'object-detect') {
      appendLog('Bu araç toplu işlem modunda henüz desteklenmiyor.', 'warning');
      return;
    }

    try {
      setBusy(true);
      appendLog(`Toplu işlem başlatıldı: ${gallery.length} görsel`, 'info');

      const newGallery = [...gallery];
      for (let i = 0; i < gallery.length; i++) {
        const item = gallery[i];
        appendLog(`[${i + 1}/${gallery.length}] ${item.name} işleniyor...`, 'info');

        try {
          let result;
          switch (operation) {
            case 'remove-background':
              result = await window.innoPhoto.removeBackground({ inputPath: item.path });
              break;
            case 'upscale':
              result = await window.innoPhoto.upscale({ inputPath: item.path, settings });
              break;
            case 'enhance':
              result = await window.innoPhoto.enhanceImage({ inputPath: item.path, settings });
              break;
            case 'convert':
              result = await window.innoPhoto.convertImage({
                inputPath: item.path,
                format: settings.targetFormat,
                quality: settings.quality
              });
              break;
          }

          if (result) {
            newGallery[i] = result;
            setGallery([...newGallery]);
            appendLog(`${item.name} başarıyla işlendi.`, 'success');
          }
        } catch (err: any) {
          appendLog(`${item.name} işlenirken hata oluştu: ${err.message}`, 'error');
        }
      }

      appendLog('Toplu işlem tamamlandı.', 'success');
    } catch (e: any) {
      appendLog(`Kritik hata: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    if (!currentImage) return;
    window.innoPhoto.openInFolder(currentImage.path);
    appendLog(`Dosya klasörde gösterildi: ${currentImage.name}`, 'info');
  };

  // --- Native Menu Actions ---
  useEffect(() => {
    const unsub = window.innoPhoto.onMenuAction((action) => {
      if (action === 'upload-image') handleFileUpload();
      if (action === 'export-result') handleExport();
    });
    return unsub;
  }, [gallery.length, currentIndex, currentImage]);

  // --- SAM Drawing ---
  const handlePointerDown: PointerEventHandler = (e) => {
    if (busy || operation !== 'object-remove' || !currentImage) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const y = e.clientY - bounds.top;
    drawingRef.current = { active: true, startX: x, startY: y };
    setDraftBox({ x, y, width: 0, height: 0 });
    setSelectionBox(null);
    setActiveMask(null);
  };

  const handlePointerMove: PointerEventHandler = (e) => {
    if (!drawingRef.current.active) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    const curX = e.clientX - bounds.left;
    const curY = e.clientY - bounds.top;

    setDraftBox({
      x: Math.min(drawingRef.current.startX, curX),
      y: Math.min(drawingRef.current.startY, curY),
      width: Math.abs(curX - drawingRef.current.startX),
      height: Math.abs(curY - drawingRef.current.startY)
    });
  };

  const handlePointerUp = async () => {
    if (!drawingRef.current.active) return;
    let finalBox = null;
    if (draftBox && draftBox.width > 5 && draftBox.height > 5) {
      finalBox = draftBox;
      setSelectionBox(draftBox);
    }
    setDraftBox(null);
    drawingRef.current.active = false;

    // Trigger AI Smart Selection
    if (finalBox && currentImage && operation === 'object-remove') {
      try {
        setBusy(true);
        appendLog('Nesne hatları tespit ediliyor (SAM)...', 'info');
        const samRes = await window.innoPhoto.segmentSelection({
          inputPath: currentImage.path,
          selectionBox: finalBox
        });
        setActiveMask(samRes.maskPath);
        appendLog(`Nesne tespit edildi (%${Math.round(samRes.coverageRatio * 100)} kapsama)`, 'success');
      } catch (e: any) {
        appendLog(`Seçim hatası: ${e.message}`, 'error');
      } finally {
        setBusy(false);
      }
    }
  };

  // --- Lifecycle ---
  useEffect(() => {
    const unsub = window.innoPhoto.onModelProgress((evt) => {
      setModelProgress(prev => ({ ...prev, [evt.modelId]: evt }));
    });
    return unsub;
  }, []);

  return (
    <div className="studio-root">
      <TopBar
        onUpload={handleFileUpload}
        onExport={handleExport}
        onToggleGallery={() => setIsGalleryOpen(!isGalleryOpen)}
        onToggleLogs={() => setIsLogOpen(true)}
        galleryCount={gallery.length}
        logCount={logs.length}
        busy={busy}
        hasResult={gallery.length > 0}
        mode={mode}
        onModeChange={(m) => {
          setMode(m);
          appendLog(`Mod değiştirildi: ${m === 'batch' ? 'Toplu İşlem' : 'Görsel İşleme'}`, 'info');
        }}
      />

      <main className="studio-layout">
        <Sidebar
          operation={operation}
          setOperation={(op) => {
            setOperation(op);
            setSelectionBox(null);
            setDetections([]);
          }}
          busy={busy}
          settings={settings}
          setSettings={setSettings}
          onRun={mode === 'batch' ? runBatchOperation : runOperation}
          sourceImage={currentImage}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Stage
            sourceImage={currentImage}
            toFileUrl={toFileUrl}
            operation={operation}
            draftBox={draftBox}
            selectionBox={selectionBox}
            activeMask={activeMask ? toFileUrl(activeMask) : null}
            detections={detections}
            settings={settings}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {isGalleryOpen && (
            <Gallery
              items={gallery}
              currentIndex={currentIndex}
              onSelect={setCurrentIndex}
              onRemove={handleRemoveFromGallery}
              toFileUrl={toFileUrl}
            />
          )}
        </div>
      </main>

      <LogModal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        logs={logs}
        onClear={() => setLogs([])}
        modelProgress={modelProgress}
      />

      {error && (
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="error-toast"
          onClick={() => setError(null)}
        >
          {error}
        </motion.div>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        .error-toast {
          position: fixed; bottom: 24px; right: 24px; z-index: 2000;
          background: var(--error); color: white; padding: 12px 20px;
          border-radius: 8px; font-size: 13px; font-weight: 600;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5); cursor: pointer;
        }
      `}} />
    </div>
  );
};

export default App;
