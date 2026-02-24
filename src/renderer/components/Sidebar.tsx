import React from 'react';
import {
    Plus,
    Maximize,
    Zap,
    Layout,
    Focus,
    Box,
    RefreshCw,
    ChevronRight,
    SlidersHorizontal
} from 'lucide-react';
import { StudioSettings } from '../types';

interface SidebarProps {
    operation: string;
    setOperation: (op: any) => void;
    busy: boolean;
    settings: StudioSettings;
    setSettings: (settings: StudioSettings) => void;
    onRun: () => void;
    sourceImage: any;
}

export const TOOLS = [
    { id: 'remove-background', label: 'Arka Plan Sil', icon: Layout, desc: 'Yapay zeka ile objeyi ayıklar' },
    { id: 'upscale', label: 'Netleştir (Fine)', icon: Maximize, desc: 'Doku kaybı olmadan büyütür' },
    { id: 'enhance', label: 'Yüz Iyileştir', icon: Zap, desc: 'Yüz ve genel doku iyileştirme' },
    { id: 'object-detect', label: 'Nesne Algıla', icon: Box, desc: 'Görseldeki objeleri tanımlar' },
    { id: 'object-remove', label: 'Nesne Sil (SAM)', icon: Focus, desc: 'Seçili alanı akıllıca siler' },
    { id: 'convert', label: 'Format Dönüştür', icon: RefreshCw, desc: 'Profesyonel format çevirici' },
] as const;

const FORMATS = ['png', 'jpeg', 'webp', 'tiff', 'bmp', 'ico', 'gif', 'avif', 'jp2', 'svg', 'heif', 'raw', 'pdf'];
const DETECTION_CLASSES = ['person', 'car', 'dog', 'cat', 'chair', 'bottle', 'bird', 'horse', 'sheep', 'cow', 'truck', 'bicycle'];

const Sidebar: React.FC<SidebarProps> = ({
    operation,
    setOperation,
    busy,
    settings,
    setSettings,
    onRun,
    sourceImage
}) => {
    const currentTool = TOOLS.find(t => t.id === operation) || TOOLS[0];

    const updateSetting = (key: keyof StudioSettings, value: any) => {
        setSettings({ ...settings, [key]: value });
    };

    return (
        <aside className="panel left-panel">
            <div className="side-content">
                <section>
                    <div className="section-head">
                        <Box size={14} />
                        <h3 className="section-title">ARAÇLAR</h3>
                    </div>
                    <div className="tool-list">
                        {TOOLS.map(tool => (
                            <button
                                key={tool.id}
                                className={`tool-item ${operation === tool.id ? 'active' : ''}`}
                                onClick={() => setOperation(tool.id)}
                            >
                                <div className="tool-icon-wrapper">
                                    <tool.icon size={18} />
                                </div>
                                <div className="tool-info">
                                    <div className="tool-name">{tool.label}</div>
                                    <div className="tool-desc">{tool.desc}</div>
                                </div>
                                {operation === tool.id && <ChevronRight size={14} className="active-indicator" />}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="settings-section">
                    <div className="section-head">
                        <SlidersHorizontal size={14} />
                        <h3 className="section-title">PARAMETRELER</h3>
                    </div>

                    <div className="settings-scroll-area">
                        {operation === 'upscale' && (
                            <div className="settings-group">
                                <div className="field">
                                    <label className="field-label">Büyütme Katsayısı</label>
                                    <div className="choice-group">
                                        {[2, 4, 8].map(factor => (
                                            <button
                                                key={factor}
                                                className={`choice-btn ${settings.upscaleFactor === factor ? 'active' : ''}`}
                                                onClick={() => updateSetting('upscaleFactor', factor)}
                                            >
                                                {factor}x
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="field">
                                    <label className="field-label">Yöntem</label>
                                    <select
                                        value={settings.upscaleMethod}
                                        onChange={(e) => updateSetting('upscaleMethod', e.target.value)}
                                        className="styled-select"
                                    >
                                        <option value="classical">Standard SR</option>
                                        <option value="realworld">Real-World Enhancer</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {operation === 'object-detect' && (
                            <div className="settings-group">
                                <div className="field">
                                    <label className="field-label">Güven Eşiği (Threshold)</label>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="0.95"
                                        step="0.05"
                                        value={settings.detectionThreshold}
                                        onChange={(e) => updateSetting('detectionThreshold', parseFloat(e.target.value))}
                                        className="styled-range"
                                    />
                                    <div className="range-val">{Math.round(settings.detectionThreshold * 100)}%</div>
                                </div>
                                <div className="field">
                                    <label className="field-label">Algılanacak Nesne Sınıfları</label>
                                    <div className="tag-cloud">
                                        {DETECTION_CLASSES.map(cls => (
                                            <button
                                                key={cls}
                                                className={`tag-btn ${settings.detectionClasses.includes(cls) ? 'active' : ''}`}
                                                onClick={() => {
                                                    const next = settings.detectionClasses.includes(cls)
                                                        ? settings.detectionClasses.filter(c => c !== cls)
                                                        : [...settings.detectionClasses, cls];
                                                    updateSetting('detectionClasses', next);
                                                }}
                                            >
                                                {cls}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {operation === 'object-remove' && (
                            <div className="settings-group">
                                <div className="field">
                                    <label className="field-label">İşlem Modu</label>
                                    <div className="choice-group">
                                        {[
                                            { id: 'remove', label: 'Nesne Sil' },
                                            { id: 'extract', label: 'Nesne Ayıkla' }
                                        ].map(mode => (
                                            <button
                                                key={mode.id}
                                                className={`choice-btn ${settings.samMode === mode.id ? 'active' : ''}`}
                                                onClick={() => updateSetting('samMode', mode.id)}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="field">
                                    <label className="field-label">Maske Konturu (Outline)</label>
                                    <div className="toggle-field">
                                        <span className="toggle-label">Seçim çizgisini göster</span>
                                        <input
                                            type="checkbox"
                                            checked={settings.outlineVisible}
                                            onChange={(e) => updateSetting('outlineVisible', e.target.checked)}
                                            className="styled-toggle"
                                        />
                                    </div>
                                </div>
                                <div className="field">
                                    <label className="field-label">Outline Rengi</label>
                                    <input
                                        type="color"
                                        value={settings.outlineColor}
                                        onChange={(e) => updateSetting('outlineColor', e.target.value)}
                                        className="styled-color"
                                    />
                                </div>
                            </div>
                        )}

                        {operation === 'enhance' && (
                            <div className="settings-group">
                                <div className="field">
                                    <label className="field-label">Netleştirme Seviyesi</label>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={settings.sharpenLevel}
                                        onChange={(e) => updateSetting('sharpenLevel', parseInt(e.target.value))}
                                        className="styled-range"
                                    />
                                    <div className="range-val">{settings.sharpenLevel}%</div>
                                </div>
                            </div>
                        )}

                        {operation === 'convert' && (
                            <div className="settings-group">
                                <div className="field">
                                    <label className="field-label">Hedef Format</label>
                                    <select
                                        className="styled-select"
                                        value={settings.targetFormat}
                                        onChange={(e) => updateSetting('targetFormat', e.target.value)}
                                    >
                                        {FORMATS.map(f => (
                                            <option key={f} value={f}>{f.toUpperCase()}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="field">
                                    <label className="field-label">Kalite (Lossy Formats)</label>
                                    <input
                                        type="range"
                                        min="10"
                                        max="100"
                                        value={settings.quality}
                                        onChange={(e) => updateSetting('quality', parseInt(e.target.value))}
                                        className="styled-range"
                                    />
                                    <div className="range-val">{settings.quality}%</div>
                                </div>
                            </div>
                        )}

                        {/* Default generic help */}
                        {['remove-background'].includes(operation) && (
                            <div className="settings-group">
                                <div className="field">
                                    <label className="field-label">Bilgi</label>
                                    <p className="setting-info-text">
                                        Bu işlem için varsayılan optimize edilmiş AI parametreleri kullanılacaktır.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                <div className="sidebar-footer">
                    <button
                        className="btn btn-primary run-button"
                        onClick={onRun}
                        disabled={!sourceImage || busy}
                    >
                        {busy ? <RefreshCw className="animate-spin" size={18} /> : <Zap size={18} />}
                        <span>{busy ? 'İŞLENİYOR...' : 'İŞLEMİ BAŞLAT'}</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
