import { useCallback, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, PanInfo } from 'framer-motion';
import { X, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
interface ImageLightboxProps {
  imageUrl: string | null;
  imageUrls?: string[];
  onClose: () => void;
}

export const ImageLightbox = ({ imageUrl, imageUrls = [], onClose }: ImageLightboxProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  // Build array of images - use imageUrls if provided, otherwise just the single imageUrl
  const allImages = imageUrls.length > 0 ? imageUrls : imageUrl ? [imageUrl] : [];
  const currentImage = allImages[currentIndex] || imageUrl;
  const hasMultipleImages = allImages.length > 1;

  // Reset state when lightbox opens or image changes
  useEffect(() => {
    if (imageUrl) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      // Find index of the opened image in the array
      const index = allImages.findIndex(url => url === imageUrl);
      setCurrentIndex(index >= 0 ? index : 0);
    }
  }, [imageUrl]);

  // Handle escape key and arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageUrl) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasMultipleImages) {
            setCurrentIndex(prev => (prev - 1 + allImages.length) % allImages.length);
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }
          break;
        case 'ArrowRight':
          if (hasMultipleImages) {
            setCurrentIndex(prev => (prev + 1) % allImages.length);
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }
          break;
        case '+':
        case '=':
          setScale(prev => Math.min(prev + 0.5, 5));
          break;
        case '-':
          setScale(prev => Math.max(prev - 0.5, 0.5));
          break;
        case '0':
          setScale(1);
          setPosition({ x: 0, y: 0 });
          break;
      }
    };

    if (imageUrl) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [imageUrl, onClose, hasMultipleImages, allImages.length]);

  // Prevent right-click on image
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  }, []);

  // Close on backdrop click - close when clicking anywhere except interactive elements
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Don't close if clicking on:
    // - Buttons or their children
    // - The image itself (when zoomed, allow dragging)
    // - Thumbnails
    // - Control bars
    if (
      target.closest('button') ||
      target.tagName === 'IMG' ||
      target.closest('.bg-gradient-to-b') || // Top controls bar
      target.closest('.bg-gradient-to-t')    // Bottom thumbnails bar
    ) {
      return;
    }
    
    // Close on backdrop or empty areas
    onClose();
  }, [onClose]);

  // Close when clicking on the image container (but not on the image itself)
  const handleImageContainerClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking on the container (empty space), not the image
    if (e.target === e.currentTarget && scale === 1) {
      onClose();
    }
  }, [scale, onClose]);

  // Download image
  const handleDownload = useCallback(async () => {
    if (!currentImage) return;
    
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from URL or use default
      const urlParts = currentImage.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0] || 'image.png';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(currentImage, '_blank');
    }
  }, [currentImage]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.5, 0.5));
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle drag end - close if dragged far enough vertically
  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (scale === 1 && Math.abs(info.offset.y) > 150) {
      onClose();
    } else if (scale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale, onClose]);

  // Handle thumbnail click
  const handleThumbnailClick = useCallback((index: number) => {
    setCurrentIndex(index);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Handle swipe for mobile navigation
  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (!hasMultipleImages) return;
    
    if (direction === 'left') {
      setCurrentIndex(prev => (prev + 1) % allImages.length);
    } else {
      setCurrentIndex(prev => (prev - 1 + allImages.length) % allImages.length);
    }
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [hasMultipleImages, allImages.length]);

  const lightboxContent = (
    <AnimatePresence>
      {imageUrl && currentImage && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md"
          onClick={handleBackdropClick}
        >
          {/* Top controls bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
            {/* Image counter */}
            <div className="text-sm text-white/80 font-medium">
              {hasMultipleImages && (
                <span>{currentIndex + 1} / {allImages.length}</span>
              )}
            </div>

            {/* Control buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleZoomOut}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Zoom out"
                title="Zoom out (-)"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button
                onClick={handleZoomIn}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Zoom in"
                title="Zoom in (+)"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={handleReset}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Reset zoom"
                title="Reset (0)"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-1" />
              <button
                onClick={handleDownload}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                aria-label="Download image"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white ml-1"
                aria-label="Close lightbox"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main image container */}
          <motion.div
            className="flex-1 flex items-center justify-center w-full overflow-hidden select-none touch-none"
            onContextMenu={handleContextMenu}
            onClick={handleImageContainerClick}
          >
            <motion.img
              src={currentImage}
              alt="Full size image"
              className="max-w-[95vw] max-h-[85vh] object-contain rounded-lg shadow-2xl select-none pointer-events-auto"
              style={{ 
                scale,
                x: position.x,
                y: position.y,
              }}
              drag={scale === 1}
              dragControls={dragControls}
              dragElastic={0.2}
              dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              draggable={false}
              onContextMenu={handleContextMenu}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              whileTap={{ cursor: 'grabbing' }}
              onPanEnd={(e, info) => {
                if (scale === 1 && hasMultipleImages) {
                  if (info.offset.x < -100) {
                    handleSwipe('left');
                  } else if (info.offset.x > 100) {
                    handleSwipe('right');
                  }
                }
              }}
            />
          </motion.div>

          {/* Thumbnails bar */}
          {hasMultipleImages && (
            <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-center gap-2 p-4 bg-gradient-to-t from-black/50 to-transparent">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 backdrop-blur-sm max-w-full overflow-x-auto">
                {allImages.map((url, index) => (
                  <button
                    key={`thumb-${index}`}
                    onClick={() => handleThumbnailClick(index)}
                    className={cn(
                      "relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all duration-200",
                      index === currentIndex
                        ? "ring-2 ring-white ring-offset-2 ring-offset-black/50 scale-105"
                        : "opacity-60 hover:opacity-100"
                    )}
                  >
                    <img
                      src={url}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation arrows for multiple images */}
          {hasMultipleImages && (
            <>
              <button
                onClick={() => handleSwipe('right')}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors text-white"
                aria-label="Previous image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => handleSwipe('left')}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/40 hover:bg-black/60 transition-colors text-white"
                aria-label="Next image"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Zoom indicator */}
          {scale !== 1 && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-black/60 text-white text-sm font-medium">
              {Math.round(scale * 100)}%
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document body level, escaping any overflow:hidden containers
  return createPortal(lightboxContent, document.body);
};
