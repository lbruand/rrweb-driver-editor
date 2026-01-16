import { useEffect } from 'react';
import type { Annotation } from '../types/annotations';
import type { PlayerInstance } from '../types/player';
import { getHashFromUrl } from '../utils/playerUtils';

export interface UseUrlHashNavigationProps {
  annotations: Annotation[];
  goToAnnotation: (annotation: Annotation) => void;
  playerRef: React.RefObject<PlayerInstance | null>;
  setActiveAnnotation: (annotation: Annotation | null) => void;
}

export function useUrlHashNavigation({
  annotations,
  goToAnnotation,
  playerRef,
  setActiveAnnotation,
}: UseUrlHashNavigationProps): void {
  useEffect(() => {
    const handleHashChange = () => {
      if (!playerRef.current || annotations.length === 0) return;

      const hash = getHashFromUrl();
      if (!hash) return;

      // Find annotation by ID
      const annotation = annotations.find(a => a.id === hash);
      if (annotation) {
        setActiveAnnotation(null); // Dismiss any active overlay
        goToAnnotation(annotation);
      }
    };

    // Navigate on initial load if there's a hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [annotations, goToAnnotation, playerRef, setActiveAnnotation]);
}