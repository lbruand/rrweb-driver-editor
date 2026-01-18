import type { Annotation } from '../types/annotations';
import type { NavigationSource } from '../types/navigation';
import { ANNOTATION_THRESHOLD_MS } from '../types/player';
import { CONFIG } from '../constants/config';
import { DEFAULT_AUTOPAUSE } from '../constants/annotations';

/**
 * Determines which annotation IDs should be marked as triggered based on navigation source.
 * Returns the new set of triggered annotation IDs.
 */
export function getTriggeredAnnotationsAfterNavigation(
  source: NavigationSource,
  annotation: Annotation,
  annotations: Annotation[],
  currentTriggered: Set<string>
): Set<string> {
  const newTriggered = new Set(currentTriggered);

  switch (source) {
    case 'keyboard':
    case 'toc':
    case 'marker':
      // Clear all triggered annotations, then mark current one as triggered
      // so it doesn't re-trigger when playback resumes
      newTriggered.clear();
      newTriggered.add(annotation.id);
      break;
    case 'hash':
      // Mark all annotations at or before target timestamp as triggered
      // This prevents earlier annotations from firing and overwriting the hash
      for (const a of annotations) {
        if (a.timestamp <= annotation.timestamp) {
          newTriggered.add(a.id);
        }
      }
      break;
    case 'playback':
      // Just add this annotation
      newTriggered.add(annotation.id);
      break;
    case 'progressBar':
      // No changes to triggered set (handled separately in seek)
      break;
  }

  return newTriggered;
}

/**
 * Determines if the URL hash should be updated for the given navigation source.
 */
export function shouldUpdateHash(source: NavigationSource): boolean {
  return source === 'keyboard' || source === 'toc' || source === 'marker' || source === 'playback';
}

/**
 * Determines if the player should pause after navigation based on source and annotation settings.
 */
export function shouldPauseAfterNavigation(
  source: NavigationSource,
  annotation: Annotation,
  explicitShouldPause?: boolean
): boolean {
  if (source === 'keyboard' || explicitShouldPause) {
    return true;
  }
  if (source === 'playback' && (annotation.autopause ?? DEFAULT_AUTOPAUSE)) {
    return true;
  }
  return false;
}

/**
 * Determines if the overlay should be shown for the given annotation and source.
 * Returns true if overlay should show, false if it should be hidden.
 */
export function shouldShowOverlay(
  source: NavigationSource,
  annotation: Annotation
): boolean {
  if (source === 'progressBar') {
    // Progress bar always clears overlay
    return false;
  }
  return !!annotation.driverJsCode;
}

/**
 * Checks if seeking backward was detected (indicating user seeked back in time).
 */
export function isBackwardSeek(
  currentTime: number,
  lastTime: number,
  threshold: number = CONFIG.ANNOTATIONS.SEEKING_BACKWARD_THRESHOLD_MS
): boolean {
  return currentTime < lastTime - threshold;
}

/**
 * Checks if an annotation should trigger based on current playback state.
 */
export function shouldAnnotationTrigger(
  annotation: Annotation,
  currentTime: number,
  triggeredIds: Set<string>,
  activeAnnotationId: string | null,
  threshold: number = ANNOTATION_THRESHOLD_MS
): boolean {
  // Skip if this annotation is already showing
  if (activeAnnotationId === annotation.id) {
    return false;
  }

  // Skip if already triggered
  if (triggeredIds.has(annotation.id)) {
    return false;
  }

  // Check if within time threshold
  const timeDiff = Math.abs(currentTime - annotation.timestamp);
  return timeDiff < threshold;
}

/**
 * Finds annotations that should trigger at the given time.
 * Returns the first annotation that should trigger, or null if none.
 */
export function findAnnotationToTrigger(
  annotations: Annotation[],
  currentTime: number,
  triggeredIds: Set<string>,
  activeAnnotationId: string | null
): Annotation | null {
  for (const annotation of annotations) {
    if (shouldAnnotationTrigger(annotation, currentTime, triggeredIds, activeAnnotationId)) {
      return annotation;
    }
  }
  return null;
}

/**
 * Gets annotation IDs that should be removed from triggered set after seeking to a time.
 * Annotations after the seek time should be removed so they can trigger again.
 */
export function getAnnotationsToUntriggerAfterSeek(
  annotations: Annotation[],
  seekTime: number
): string[] {
  return annotations
    .filter(a => a.timestamp > seekTime)
    .map(a => a.id);
}
