import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Crosshair } from 'lucide-react';
import { ImageInfo, Detection, SelectionBox, StudioSettings } from '../types';

interface StageProps {
    sourceImage: ImageInfo | null;
    toFileUrl: (path: string | null) => string;
    operation: string;
    draftBox: SelectionBox | null;
    selectionBox: SelectionBox | null;
    activeMask: string | null;
    detections: Detection[];
    settings: StudioSettings;
    onPointerDown: React.PointerEventHandler;
    onPointerMove: React.PointerEventHandler;
    onPointerUp: React.PointerEventHandler;
}

const Stage: React.FC<StageProps> = ({
    sourceImage,
    toFileUrl,
    operation,
    draftBox,
    selectionBox,
    activeMask,
    detections,
    settings,
    onPointerDown,
    onPointerMove,
    onPointerUp
}) => {
    const stageRef = useRef<HTMLDivElement>(null);

    return (
        <section className="viewport-panel">
            <div
                className={`stage-container ${operation === 'object-remove' ? 'selecting' : ''}`}
                ref={stageRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
                <AnimatePresence mode="wait">
                    {sourceImage ? (
                        <motion.div
                            key={sourceImage.path}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            className="canvas-wrapper"
                        >
                            <img
                                src={toFileUrl(sourceImage.path)}
                                alt="Stage"
                                className="image-canvas"
                                draggable={false}
                            />

                            {/* Smart AI Mask Overlay */}
                            {activeMask && settings.outlineVisible && (
                                <div
                                    className="smart-mask-overlay"
                                    style={{
                                        WebkitMaskImage: `url(${activeMask})`,
                                        maskImage: `url(${activeMask})`,
                                        '--outline-color': settings.outlineColor
                                    } as any}
                                >
                                    <div className="mask-glow-layer" />
                                </div>
                            )}

                            {/* Selection Boxes */}
                            {draftBox && (
                                <div className="box-draft" style={{
                                    left: draftBox.x, top: draftBox.y, width: draftBox.width, height: draftBox.height
                                }} />
                            )}

                            {selectionBox && (
                                <div
                                    className={`box-final ${settings.outlineVisible ? 'with-outline' : ''}`}
                                    style={{
                                        left: selectionBox.x, top: selectionBox.y, width: selectionBox.width, height: selectionBox.height,
                                        '--outline-color': settings.outlineColor
                                    } as any}
                                >
                                    {settings.outlineVisible && <div className="selection-glow" />}
                                </div>
                            )}

                            {/* Detections */}
                            {detections.map((d, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="detection-box"
                                    style={{
                                        left: d.box.xmin, top: d.box.ymin,
                                        width: d.box.xmax - d.box.xmin, height: d.box.ymax - d.box.ymin
                                    }}
                                >
                                    <span className="detection-label">
                                        {d.label} {Math.round(d.score * 100)}%
                                    </span>
                                </motion.div>
                            ))}

                            {/* SAM Crosshair Helper */}
                            {operation === 'object-remove' && !selectionBox && !draftBox && (
                                <div className="selection-helper">
                                    <Crosshair size={24} />
                                    <span>Silinecek alanı kare içine alın</span>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon-circle">
                                <ImageIcon size={48} strokeWidth={1} />
                            </div>
                            <p className="empty-title">Stüdyo Hazır</p>
                            <p className="empty-desc">Başlamak için bir görsel sürükleyin veya yükleyin</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </section>
    );
};

export default Stage;
