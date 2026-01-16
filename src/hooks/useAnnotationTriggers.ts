import { useState, useEffect, useCallback, useRef } from 'react';
import type { Annotation } from '../types/annotations';
import type { PlayerInstance } from '../types/player';
import { ANNOTATION_THRESHOLD_MS } from '../types/player';
import { DEFAULT_AUTOPAUSE } from '../constants/annotations';
import { updateUrlHash } from '../utils/playerUtils';

export interface UseAnnotationTriggersProps {
  playerRef: React.RefObject<PlayerInstance | null>;
  annotations: Annotation[];
  iframeElement: HTMLIFrameElement | null;
  setActiveAnnotation: (annotation: Annotation | null) => void;
}

export interface UseAnnotationTriggersResult {
  currentTime: number;
  triggeredAnnotationsRef: React.MutableRefObject<Set<string>>;
}

export function useAnnotationTriggers({
  playerRef,
  annotations,
  iframeElement,
  setActiveAnnotation,
}: UseAnnotationTriggersProps): UseAnnotationTriggersResult {
  const [currentTime, setCurrentTime] = useState(0);
  const triggeredAnnotationsRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);

  // Check for annotation triggers
  const checkAnnotationTriggers = useCallback(
    (time: number) => {
      // Detect seeking backward - reset triggered annotations
      if (time < lastTimeRef.current - 1000) {
        triggeredAnnotationsRef.current.clear();
      }
      lastTimeRef.current = time;

      for (const annotation of annotations) {
        const timeDiff = Math.abs(time - annotation.timestamp);
        if (
          timeDiff < ANNOTATION_THRESHOLD_MS &&
          !triggeredAnnotationsRef.current.has(annotation.id)
        ) {
          triggeredAnnotationsRef.current.add(annotation.id);

          // Update URL hash immediately when annotation triggers
          updateUrlHash(annotation.id);

          if (annotation.autopause ?? DEFAULT_AUTOPAUSE) {
            playerRef.current?.pause();
          }

          if (annotation.driverJsCode) {
            setActiveAnnotation(annotation);
          }
        }
      }
    },
    [annotations, playerRef, setActiveAnnotation]
  );

  // Poll for current time
  // Note: iframeElement is set after player creation, so using it as dependency
  // ensures this effect runs after the player is ready
  useEffect(() => {
    if (!playerRef.current || !iframeElement) return;

    const interval = setInterval(() => {
      const replayer = playerRef.current?.getReplayer?.();
      if (replayer?.getCurrentTime) {
        const time = replayer.getCurrentTime();
        setCurrentTime(time);
        checkAnnotationTriggers(time);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [checkAnnotationTriggers, iframeElement, playerRef]);

  return { currentTime, triggeredAnnotationsRef };
}