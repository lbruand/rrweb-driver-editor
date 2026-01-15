import { useEffect, useState, useCallback } from 'react';
import type { Annotation } from '../types/annotations';

interface ProgressBarBounds {
  left: number;
  width: number;
  top: number;
}

interface AnnotationMarkersProps {
  annotations: Annotation[];
  totalDuration: number;
  onMarkerClick: (annotation: Annotation) => void;
  showControls: boolean;
}

// Cache bounds between renders so we can show markers immediately
let cachedBounds: ProgressBarBounds | null = null;

export function AnnotationMarkers({
  annotations,
  totalDuration,
  onMarkerClick,
  showControls,
}: AnnotationMarkersProps) {
  const [progressBarBounds, setProgressBarBounds] = useState<ProgressBarBounds | null>(cachedBounds);
  const [isVisible, setIsVisible] = useState(false);

  const updateProgressBarBounds = useCallback(() => {
    // Find the progress bar element in rrweb player
    const progressBar = document.querySelector('.rr-progress');
    if (progressBar) {
      const rect = progressBar.getBoundingClientRect();
      // Only update if we get valid bounds (element is visible)
      if (rect.width > 0) {
        const bounds = {
          left: rect.left,
          width: rect.width,
          top: rect.top + rect.height / 2,
        };
        cachedBounds = bounds;
        setProgressBarBounds(bounds);
      }
    }
  }, []);

  useEffect(() => {
    if (showControls) {
      // Update bounds immediately
      updateProgressBarBounds();
      // Delay visibility to allow initial render in hidden state, then animate in
      const visibilityTimer = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      // Also update bounds after animation completes
      const boundsTimer = setTimeout(updateProgressBarBounds, 350);
      return () => {
        cancelAnimationFrame(visibilityTimer);
        clearTimeout(boundsTimer);
      };
    } else {
      setIsVisible(false);
    }
  }, [showControls, updateProgressBarBounds]);

  useEffect(() => {
    // Update on resize
    window.addEventListener('resize', updateProgressBarBounds);
    return () => window.removeEventListener('resize', updateProgressBarBounds);
  }, [updateProgressBarBounds]);

  // Don't render if no annotations or duration
  if (totalDuration <= 0 || annotations.length === 0) {
    return null;
  }

  // Use cached bounds for positioning
  const bounds = progressBarBounds || cachedBounds;

  return (
    <div
      className={`annotation-markers ${isVisible ? 'visible' : ''}`}
      style={
        bounds
          ? {
              left: bounds.left,
              width: bounds.width,
              top: bounds.top,
            }
          : {
              left: '10%',
              right: '10%',
              bottom: 40,
            }
      }
    >
      {annotations.map((annotation) => {
        const percentage = (annotation.timestamp / totalDuration) * 100;
        return (
          <div
            key={annotation.id}
            className="annotation-marker"
            style={{
              left: `${percentage}%`,
              backgroundColor: annotation.color || '#2196F3',
            }}
            data-title={annotation.title}
            onClick={(e) => {
              e.stopPropagation();
              onMarkerClick(annotation);
            }}
          />
        );
      })}
    </div>
  );
}
