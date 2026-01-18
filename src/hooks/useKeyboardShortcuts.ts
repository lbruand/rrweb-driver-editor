import { useEffect } from 'react';
import type { Annotation } from '../types/annotations';
import type { PlayerInstance } from '../types/player';
import { ANNOTATION_THRESHOLD_MS } from '../types/player';
import { DOM_SELECTORS } from '../constants/selectors';

export interface UseKeyboardShortcutsProps {
  annotations: Annotation[];
  currentTime: number;
  goToAnnotation: (annotation: Annotation) => void;
  iframeElement: HTMLIFrameElement | null;
  playerRef: React.RefObject<PlayerInstance | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  setActiveAnnotation: (annotation: Annotation | null) => void;
}

export function useKeyboardShortcuts({
  annotations,
  currentTime,
  goToAnnotation,
  iframeElement,
  playerRef,
  containerRef,
  setActiveAnnotation,
}: UseKeyboardShortcutsProps): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in an input outside the iframe
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!playerRef.current) return;

      switch (e.key) {
        case 'ArrowRight': {
          // Skip to next bookmark and pause
          e.preventDefault();
          setActiveAnnotation(null); // Dismiss any active overlay
          const nextAnnotation = annotations.find(
            (annotation) => annotation.timestamp > currentTime
          );
          if (nextAnnotation) {
            goToAnnotation(nextAnnotation);
            playerRef.current.pause();
          }
          break;
        }
        case 'ArrowLeft': {
          // Go back to previous bookmark and pause
          e.preventDefault();
          setActiveAnnotation(null); // Dismiss any active overlay
          // Find annotations before current time, get the last one
          const previousAnnotations = annotations.filter(
            (annotation) => annotation.timestamp < currentTime - ANNOTATION_THRESHOLD_MS
          );
          const previousAnnotation = previousAnnotations[previousAnnotations.length - 1];
          if (previousAnnotation) {
            goToAnnotation(previousAnnotation);
            playerRef.current.pause();
          }
          break;
        }
        case ' ': {
          // Play/pause toggle
          e.preventDefault();
          setActiveAnnotation(null); // Dismiss any active overlay
          // Find controller button in document.body (controller is appended there)
          const controller = document.querySelector(DOM_SELECTORS.RR_CONTROLLER_BTN);
          if (controller instanceof HTMLElement) {
            controller.click();
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Also listen for keyboard events inside the iframe to prevent them from being typed
    if (iframeElement?.contentDocument) {
      iframeElement.contentDocument.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (iframeElement?.contentDocument) {
        iframeElement.contentDocument.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [annotations, currentTime, goToAnnotation, iframeElement, playerRef, containerRef, setActiveAnnotation]);
}