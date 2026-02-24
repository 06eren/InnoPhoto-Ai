import React from 'react';
import {
    Plus,
    Terminal,
    Layers,
    Download,
    Share2,
    Cpu,
    Info
} from 'lucide-react';
import { motion } from 'framer-motion';

interface TopBarProps {
    onUpload: () => void;
    onExport: () => void;
    onToggleGallery: () => void;
    onToggleLogs: () => void;
    galleryCount: number;
    logCount: number;
    busy: boolean;
    hasResult: boolean;
    mode: 'single' | 'batch';
    onModeChange: (mode: 'single' | 'batch') => void;
}

const TopBar: React.FC<TopBarProps> = ({
    onUpload,
    onExport,
    onToggleGallery,
    onToggleLogs,
    galleryCount,
    logCount,
    busy,
    hasResult,
    mode,
    onModeChange
}) => {
    return (
        <header className="topbar">
            <div className="brand-group">
                <div className="brand-icon">
                    <Cpu size={20} className="brand-glow" />
                </div>
                <div className="brand">
                    <div className="brand-title">
                        InnoPhoto AI
                        <span className="brand-badge">PRO</span>
                        <span className="brand-divider">/</span>
                        <span className="brand-sub">Studio</span>
                    </div>
                </div>
            </div>

            <div className="top-navigation">
                <button
                    className={`nav-tab ${mode === 'single' ? 'active' : ''}`}
                    onClick={() => onModeChange('single')}
                >
                    Görsel İşleme
                </button>
                <button
                    className={`nav-tab ${mode === 'batch' ? 'active' : ''}`}
                    onClick={() => onModeChange('batch')}
                >
                    Toplu İşlem
                </button>
            </div>

            <div className="top-actions">
                {/* Statistics / Quick Info */}
                <div className="quick-stats">
                    <button className="stat-pill" onClick={onToggleGallery}>
                        <Layers size={14} />
                        <span>{galleryCount} Görsel</span>
                    </button>
                    <button className="stat-pill" onClick={onToggleLogs}>
                        <Terminal size={14} />
                        <span>{logCount} Kayıt</span>
                    </button>
                </div>

                <div className="action-divider" />

                <div className="button-group">
                    <button className="btn btn-ghost" onClick={onUpload} disabled={busy}>
                        <Plus size={16} />
                        <span>Ekle</span>
                    </button>

                    <button
                        className={`btn btn-primary ${!hasResult ? 'disabled' : ''}`}
                        onClick={onExport}
                        disabled={!hasResult || busy}
                    >
                        <Download size={16} />
                        <span>Dışa Aktar</span>
                    </button>
                </div>

                <button className="btn-icon-more">
                    <Info size={18} />
                </button>
            </div>
        </header>
    );
};

export default TopBar;
