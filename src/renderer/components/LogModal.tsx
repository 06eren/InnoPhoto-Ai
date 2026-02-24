import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Trash2, Activity } from 'lucide-react';
import { ModelProgressEvent } from '../types';

interface LogModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs: { id: string; msg: string; type: 'info' | 'success' | 'error' | 'warning'; time: string }[];
    onClear: () => void;
    modelProgress: Record<string, ModelProgressEvent>;
}

const LogModal: React.FC<LogModalProps> = ({ isOpen, onClose, logs, onClear, modelProgress }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="log-modal-overlay">
                    <motion.div
                        initial={{ opacity: 0, x: 400 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 400 }}
                        className="log-drawer"
                    >
                        <div className="log-drawer-header">
                            <div className="log-drawer-title">
                                <Terminal size={18} />
                                <span>Sistem Denetleyicisi</span>
                            </div>
                            <div className="log-drawer-actions">
                                <button className="icon-btn-plain" onClick={onClear} title="Logları temizle">
                                    <Trash2 size={16} />
                                </button>
                                <button className="icon-btn-plain" onClick={onClose}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="log-drawer-content">
                            {/* Model Progress Section in Logs */}
                            <section className="drawer-section">
                                <div className="drawer-section-head">
                                    <Activity size={14} />
                                    <span>Model Motoru Durumu</span>
                                </div>
                                <div className="drawer-model-stats">
                                    {Object.values(modelProgress).map(p => (
                                        <div key={p.modelId} className="drawer-stat-item">
                                            <div className="stat-label">
                                                <span className="stat-name">{p.modelId.split('/').pop()}</span>
                                                <span className="stat-val">{Math.round(p.progress || 0)}%</span>
                                            </div>
                                            <div className="stat-bar">
                                                <div className="stat-fill" style={{ width: `${p.progress}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(modelProgress).length === 0 && (
                                        <div className="drawer-empty-text">Aktif model işlemi yok</div>
                                    )}
                                </div>
                            </section>

                            <section className="drawer-section logs-flow">
                                <div className="drawer-section-head">
                                    <Terminal size={14} />
                                    <span>İşlem Günlüğü</span>
                                </div>
                                <div className="drawer-log-container">
                                    {logs.length === 0 ? (
                                        <div className="drawer-empty-text">Kayıt bulunamadı</div>
                                    ) : (
                                        logs.map((log) => (
                                            <div key={log.id} className={`drawer-log-item ${log.type}`}>
                                                <span className="log-time">[{log.time}]</span>
                                                <span className="log-msg">{log.msg}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default LogModal;
