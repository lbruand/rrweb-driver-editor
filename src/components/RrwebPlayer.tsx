import { useState, useCallback } from 'react';
import { useAnnotations } from '../hooks/useAnnotations';
import { usePlayerInstance } from '../hooks/usePlayerInstance';
import { useAnnotationTriggers } from '../hooks/useAnnotationTriggers';
import { useUrlHashNavigation } from '../hooks/useUrlHashNavigation';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AnnotationMarkers } from './AnnotationMarkers';
import { TableOfContents } from './TableOfContents';
import { AnnotationOverlay } from './AnnotationOverlay';
import type { Annotation } from '../types/annotations';
import { updateUrlHash } from '../utils/playerUtils';

interface RrwebPlayerProps {
  recordingUrl: string;
  annotationsUrl?: string;
}

export function RrwebPlayer({ recordingUrl, annotationsUrl }: RrwebPlayerProps) {
  // Load annotations
  const { annotations, sections, title } = useAnnotations(annotationsUrl);

  // Initialize player instance
  const {
    playerRef,
    containerRef,
    containerCallbackRef,
    wrapperRef,
    loading,
    error,
    tooSmall,
    iframeElement,
    totalDuration,
    showControls,
  } = usePlayerInstance(recordingUrl);

  // UI state
  const [tocOpen, setTocOpen] = useState(false);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);

  // Navigation helper with hash update
  const goToAnnotation = useCallback((annotation: Annotation) => {
    if (playerRef.current) {
      playerRef.current.goto(annotation.timestamp);
      // Update URL hash when navigating to annotation
      updateUrlHash(annotation.id);
    }
  }, [playerRef]);

  // Track annotation triggers and current time
  const { currentTime, triggeredAnnotationsRef } = useAnnotationTriggers({
    playerRef,
    annotations,
    iframeElement,
    setActiveAnnotation,
  });

  // Clear triggered annotations when navigating
  const goToAnnotationWithClear = useCallback((annotation: Annotation) => {
    triggeredAnnotationsRef.current.clear();
    goToAnnotation(annotation);
  }, [goToAnnotation, triggeredAnnotationsRef]);

  // Handle URL hash navigation
  useUrlHashNavigation({
    annotations,
    goToAnnotation: goToAnnotationWithClear,
    playerRef,
    setActiveAnnotation,
  });

  // Handle keyboard shortcuts
  useKeyboardShortcuts({
    annotations,
    currentTime,
    goToAnnotation: goToAnnotationWithClear,
    iframeElement,
    playerRef,
    containerRef,
    setActiveAnnotation,
  });

  // Update document title
  useDocumentTitle(title);

  // Handle overlay dismissal
  const handleDismissOverlay = useCallback(() => {
    setActiveAnnotation(null);
  }, []);

  const showPlayer = !loading && !error && !tooSmall;
  const hasAnnotations = annotations.length > 0;

  return (
    <div className="rrweb-player-wrapper" ref={wrapperRef}>
      {loading && <div className="loading">Loading recording...</div>}
      {error && <div className="error">Error: {error}</div>}
      {tooSmall && !loading && !error && (
        <div className="too-small">
          Browser window is too small to display the recording.
          Please resize your window.
        </div>
      )}
      {showPlayer && (
        <>
          <div
            ref={containerCallbackRef}
            className={`player-container ${showControls ? 'show-controls' : ''}`}
          />
          {hasAnnotations && (
            <>
              <AnnotationMarkers
                annotations={annotations}
                totalDuration={totalDuration}
                onMarkerClick={goToAnnotationWithClear}
                showControls={showControls}
              />
              <TableOfContents
                sections={sections}
                annotations={annotations}
                title={title}
                currentTime={currentTime}
                onAnnotationClick={goToAnnotationWithClear}
                isOpen={tocOpen}
                onToggle={() => setTocOpen((v) => !v)}
              />
              <AnnotationOverlay
                activeAnnotation={activeAnnotation}
                iframeElement={iframeElement}
                onDismiss={handleDismissOverlay}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}