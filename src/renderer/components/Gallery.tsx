import React from 'react';
import { motion } from 'framer-motion';
import { Layers, X } from 'lucide-react';
import { ImageInfo } from '../types';

interface GalleryProps {
    items: ImageInfo[];
    currentIndex: number;
    onSelect: (index: number) => void;
    onRemove: (index: number) => void;
    toFileUrl: (path: string) => string;
}

const Gallery: React.FC<GalleryProps> = ({ items, currentIndex, onSelect, onRemove, toFileUrl }) => {
    if (items.length === 0) return null;

    return (
        <section className="gallery-section">
            <div className="gallery-header">
                <div className="gallery-title">
                    <Layers size={14} />
                    <span>GALERİ ({items.length})</span>
                </div>
            </div>
            <div className="gallery-filmstrip">
                <div className="gallery-items">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.path + index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`gallery-item ${index === currentIndex ? 'active' : ''}`}
                            onClick={() => onSelect(index)}
                        >
                            <div className="gallery-thumb-wrapper">
                                <img src={toFileUrl(item.path)} alt={item.name} className="gallery-thumb" />
                            </div>
                            <div className="gallery-item-info">
                                <span className="gallery-item-name">{item.name}</span>
                            </div>
                            <button
                                className="gallery-remove-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemove(index);
                                }}
                            >
                                <X size={12} />
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Gallery;
