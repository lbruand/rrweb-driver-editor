import { useEffect, useRef } from 'react';
import type { Annotation } from '../types/annotations';
import type { UseNavigationResult } from './useNavigation';
import { getHashFromUrl } from '../utils/playerUtils';

export interface UseUrlHashNavigationProps {
  annotations: Annotation[];
  navigation: UseNavigationResult;
  iframeElement: HTMLIFrameElement | null;
}

export function useUrlHashNavigation({
  annotations,
  navigation,
  iframeElement,
}: UseUrlHashNavigationProps): void {
  // Use a ref for navigation to avoid effect re-running on every render
  const navigationRef = useRef(navigation);
  // Track if we've done the initial hash navigation
  const initialNavigationDoneRef = useRef(false);

  // Update ref in an effect to satisfy lint rules
  useEffect(() => {
    navigationRef.current = navigation;
  });

  useEffect(() => {
    const handleHashNavigation = (isInitial: boolean) => {
      // Wait until player is fully ready (iframeElement is set after player creation)
      if (!iframeElement || annotations.length === 0) return;

      const hash = getHashFromUrl();
      if (!hash) return;

      // For initial load, only navigate once
      if (isInitial && initialNavigationDoneRef.current) {
        return;
      }

      // Find annotation by ID
      const annotation = annotations.find(a => a.id === hash);
      if (annotation) {
        if (isInitial) {
          initialNavigationDoneRef.current = true;
        }
        navigationRef.current.navigateToAnnotation({
          annotation,
          source: 'hash',
        });
      }
    };

    // Navigate on initial load if there's a hash
    // Use requestAnimationFrame to ensure player is fully initialized
    // (the replayer needs an extra frame after iframe is available)
    const frameId = requestAnimationFrame(() => {
      handleHashNavigation(true);
    });

    // Listen for hash changes (user clicking links, browser back/forward)
    const onHashChange = () => handleHashNavigation(false);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [annotations, iframeElement]);
}
