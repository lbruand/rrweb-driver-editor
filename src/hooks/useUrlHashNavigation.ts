import { useEffect } from 'react';
import type { Annotation } from '../types/annotations';
import type { PlayerInstance } from '../types/player';
import { getHashFromUrl } from '../utils/playerUtils';

export interface UseUrlHashNavigationProps {
  annotations: Annotation[];
  goToAnnotation: (annotation: Annotation) => void;
  playerRef: React.RefObject<PlayerInstance | null>;
  setActiveAnnotation: (annotation: Annotation | null) => void;
  iframeElement: HTMLIFrameElement | null;
  triggeredAnnotationsRef: React.MutableRefObject<Set<string>>;
}

export function useUrlHashNavigation({
  annotations,
  goToAnnotation,
  playerRef,
  setActiveAnnotation,
  iframeElement,
  triggeredAnnotationsRef,
}: UseUrlHashNavigationProps): void {
  useEffect(() => {
    const handleHashChange = () => {
      // Wait until player is fully ready (iframeElement is set after player creation)
      if (!playerRef.current || !iframeElement || annotations.length === 0) return;

      const hash = getHashFromUrl();
      if (!hash) return;

      // Find annotation by ID
      const annotation = annotations.find(a => a.id === hash);
      if (annotation) {
        // Mark all annotations at or before target timestamp as triggered
        // This prevents earlier annotations from firing and overwriting the hash
        for (const a of annotations) {
          if (a.timestamp <= annotation.timestamp) {
            triggeredAnnotationsRef.current.add(a.id);
          }
        }

        goToAnnotation(annotation);

        // Show overlay if annotation has driver.js code
        if (annotation.driverJsCode) {
          setActiveAnnotation(annotation);
        } else {
          setActiveAnnotation(null);
        }
      }
    };

    // Navigate on initial load if there's a hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [annotations, goToAnnotation, playerRef, setActiveAnnotation, iframeElement, triggeredAnnotationsRef]);
}