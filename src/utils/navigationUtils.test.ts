import { describe, it, expect } from 'vitest';
import type { Annotation } from '../types/annotations';
import {
  getTriggeredAnnotationsAfterNavigation,
  shouldUpdateHash,
  shouldPauseAfterNavigation,
  shouldShowOverlay,
  isBackwardSeek,
  shouldAnnotationTrigger,
  findAnnotationToTrigger,
  getAnnotationsToUntriggerAfterSeek,
} from './navigationUtils';

// Test fixtures
const createAnnotation = (id: string, timestamp: number, options?: Partial<Annotation>): Annotation => ({
  id,
  title: `Annotation ${id}`,
  timestamp,
  ...options,
});

const annotations: Annotation[] = [
  createAnnotation('a1', 1000),
  createAnnotation('a2', 2000, { driverJsCode: 'some code' }),
  createAnnotation('a3', 3000, { autopause: false }),
  createAnnotation('a4', 4000, { driverJsCode: 'more code', autopause: true }),
];

describe('getTriggeredAnnotationsAfterNavigation', () => {
  it('clears and adds current for keyboard navigation', () => {
    const current = new Set(['a1', 'a2']);
    const result = getTriggeredAnnotationsAfterNavigation('keyboard', annotations[2], annotations, current);

    expect(result.size).toBe(1);
    expect(result.has('a3')).toBe(true);
    expect(result.has('a1')).toBe(false);
    expect(result.has('a2')).toBe(false);
  });

  it('clears and adds current for toc navigation', () => {
    const current = new Set(['a1']);
    const result = getTriggeredAnnotationsAfterNavigation('toc', annotations[1], annotations, current);

    expect(result.size).toBe(1);
    expect(result.has('a2')).toBe(true);
  });

  it('clears and adds current for marker navigation', () => {
    const current = new Set(['a1', 'a2', 'a3']);
    const result = getTriggeredAnnotationsAfterNavigation('marker', annotations[0], annotations, current);

    expect(result.size).toBe(1);
    expect(result.has('a1')).toBe(true);
  });

  it('marks all annotations at or before timestamp for hash navigation', () => {
    const current = new Set<string>();
    const result = getTriggeredAnnotationsAfterNavigation('hash', annotations[2], annotations, current);

    expect(result.size).toBe(3);
    expect(result.has('a1')).toBe(true);
    expect(result.has('a2')).toBe(true);
    expect(result.has('a3')).toBe(true);
    expect(result.has('a4')).toBe(false);
  });

  it('preserves existing and adds new for hash navigation', () => {
    const current = new Set(['a4']); // Already has a4
    const result = getTriggeredAnnotationsAfterNavigation('hash', annotations[1], annotations, current);

    expect(result.has('a1')).toBe(true);
    expect(result.has('a2')).toBe(true);
    expect(result.has('a4')).toBe(true); // Preserved
  });

  it('only adds current annotation for playback', () => {
    const current = new Set(['a1']);
    const result = getTriggeredAnnotationsAfterNavigation('playback', annotations[1], annotations, current);

    expect(result.size).toBe(2);
    expect(result.has('a1')).toBe(true);
    expect(result.has('a2')).toBe(true);
  });

  it('makes no changes for progressBar', () => {
    const current = new Set(['a1', 'a2']);
    const result = getTriggeredAnnotationsAfterNavigation('progressBar', annotations[2], annotations, current);

    expect(result.size).toBe(2);
    expect(result.has('a1')).toBe(true);
    expect(result.has('a2')).toBe(true);
  });

  it('does not mutate the original set', () => {
    const current = new Set(['a1', 'a2']);
    getTriggeredAnnotationsAfterNavigation('keyboard', annotations[2], annotations, current);

    expect(current.size).toBe(2);
    expect(current.has('a1')).toBe(true);
    expect(current.has('a2')).toBe(true);
  });
});

describe('shouldUpdateHash', () => {
  it('returns true for keyboard', () => {
    expect(shouldUpdateHash('keyboard')).toBe(true);
  });

  it('returns true for toc', () => {
    expect(shouldUpdateHash('toc')).toBe(true);
  });

  it('returns true for marker', () => {
    expect(shouldUpdateHash('marker')).toBe(true);
  });

  it('returns true for playback', () => {
    expect(shouldUpdateHash('playback')).toBe(true);
  });

  it('returns false for hash', () => {
    expect(shouldUpdateHash('hash')).toBe(false);
  });

  it('returns false for progressBar', () => {
    expect(shouldUpdateHash('progressBar')).toBe(false);
  });
});

describe('shouldPauseAfterNavigation', () => {
  it('always pauses for keyboard navigation', () => {
    expect(shouldPauseAfterNavigation('keyboard', annotations[0])).toBe(true);
    expect(shouldPauseAfterNavigation('keyboard', annotations[2])).toBe(true); // autopause: false
  });

  it('pauses when explicitShouldPause is true', () => {
    expect(shouldPauseAfterNavigation('toc', annotations[0], true)).toBe(true);
    expect(shouldPauseAfterNavigation('hash', annotations[0], true)).toBe(true);
  });

  it('pauses for playback with default autopause (true)', () => {
    expect(shouldPauseAfterNavigation('playback', annotations[0])).toBe(true);
    expect(shouldPauseAfterNavigation('playback', annotations[1])).toBe(true);
  });

  it('does not pause for playback when autopause is false', () => {
    expect(shouldPauseAfterNavigation('playback', annotations[2])).toBe(false);
  });

  it('pauses for playback when autopause is explicitly true', () => {
    expect(shouldPauseAfterNavigation('playback', annotations[3])).toBe(true);
  });

  it('does not pause for toc without explicit flag', () => {
    expect(shouldPauseAfterNavigation('toc', annotations[0])).toBe(false);
  });

  it('does not pause for marker without explicit flag', () => {
    expect(shouldPauseAfterNavigation('marker', annotations[0])).toBe(false);
  });

  it('does not pause for hash without explicit flag', () => {
    expect(shouldPauseAfterNavigation('hash', annotations[0])).toBe(false);
  });
});

describe('shouldShowOverlay', () => {
  it('returns false for progressBar regardless of driverJsCode', () => {
    expect(shouldShowOverlay('progressBar', annotations[0])).toBe(false);
    expect(shouldShowOverlay('progressBar', annotations[1])).toBe(false); // has driverJsCode
  });

  it('returns true when annotation has driverJsCode', () => {
    expect(shouldShowOverlay('keyboard', annotations[1])).toBe(true);
    expect(shouldShowOverlay('toc', annotations[3])).toBe(true);
  });

  it('returns false when annotation has no driverJsCode', () => {
    expect(shouldShowOverlay('keyboard', annotations[0])).toBe(false);
    expect(shouldShowOverlay('hash', annotations[2])).toBe(false);
  });
});

describe('isBackwardSeek', () => {
  it('returns true when current time is significantly before last time', () => {
    expect(isBackwardSeek(0, 2000, 1000)).toBe(true);
    expect(isBackwardSeek(500, 2000, 1000)).toBe(true);
  });

  it('returns false when current time is within threshold', () => {
    expect(isBackwardSeek(1500, 2000, 1000)).toBe(false);
    expect(isBackwardSeek(1001, 2000, 1000)).toBe(false);
  });

  it('returns false when current time is ahead', () => {
    expect(isBackwardSeek(3000, 2000, 1000)).toBe(false);
  });

  it('returns false when times are equal', () => {
    expect(isBackwardSeek(2000, 2000, 1000)).toBe(false);
  });

  it('uses default threshold from config', () => {
    // Default is 1000ms
    expect(isBackwardSeek(0, 1500)).toBe(true);
    expect(isBackwardSeek(600, 1500)).toBe(false);
  });
});

describe('shouldAnnotationTrigger', () => {
  it('returns false if annotation is currently active', () => {
    const triggered = new Set<string>();
    expect(shouldAnnotationTrigger(annotations[0], 1000, triggered, 'a1')).toBe(false);
  });

  it('returns false if annotation is already triggered', () => {
    const triggered = new Set(['a1']);
    expect(shouldAnnotationTrigger(annotations[0], 1000, triggered, null)).toBe(false);
  });

  it('returns true if within threshold and not triggered', () => {
    const triggered = new Set<string>();
    expect(shouldAnnotationTrigger(annotations[0], 1000, triggered, null)).toBe(true);
    expect(shouldAnnotationTrigger(annotations[0], 1050, triggered, null)).toBe(true);
    expect(shouldAnnotationTrigger(annotations[0], 950, triggered, null)).toBe(true);
  });

  it('returns false if outside threshold', () => {
    const triggered = new Set<string>();
    expect(shouldAnnotationTrigger(annotations[0], 1100, triggered, null, 100)).toBe(false);
    expect(shouldAnnotationTrigger(annotations[0], 800, triggered, null, 100)).toBe(false);
  });

  it('uses custom threshold when provided', () => {
    const triggered = new Set<string>();
    expect(shouldAnnotationTrigger(annotations[0], 1200, triggered, null, 250)).toBe(true);
    expect(shouldAnnotationTrigger(annotations[0], 1200, triggered, null, 150)).toBe(false);
  });
});

describe('findAnnotationToTrigger', () => {
  it('returns first annotation that should trigger', () => {
    const triggered = new Set<string>();
    const result = findAnnotationToTrigger(annotations, 1050, triggered, null);

    expect(result).toBe(annotations[0]);
  });

  it('returns null if no annotations should trigger', () => {
    const triggered = new Set(['a1', 'a2', 'a3', 'a4']);
    const result = findAnnotationToTrigger(annotations, 1000, triggered, null);

    expect(result).toBe(null);
  });

  it('skips triggered annotations', () => {
    const triggered = new Set(['a1']);
    const result = findAnnotationToTrigger(annotations, 1050, triggered, null);

    expect(result).toBe(null); // a1 is closest but triggered
  });

  it('skips active annotation', () => {
    const triggered = new Set<string>();
    const result = findAnnotationToTrigger(annotations, 1050, triggered, 'a1');

    expect(result).toBe(null);
  });

  it('returns null if time is not near any annotation', () => {
    const triggered = new Set<string>();
    const result = findAnnotationToTrigger(annotations, 5000, triggered, null);

    expect(result).toBe(null);
  });
});

describe('getAnnotationsToUntriggerAfterSeek', () => {
  it('returns annotations after seek time', () => {
    const result = getAnnotationsToUntriggerAfterSeek(annotations, 2500);

    expect(result).toEqual(['a3', 'a4']);
  });

  it('returns empty array if seek is at the end', () => {
    const result = getAnnotationsToUntriggerAfterSeek(annotations, 5000);

    expect(result).toEqual([]);
  });

  it('returns all annotations if seek is at the beginning', () => {
    const result = getAnnotationsToUntriggerAfterSeek(annotations, 0);

    expect(result).toEqual(['a1', 'a2', 'a3', 'a4']);
  });

  it('does not include annotation at exact seek time', () => {
    const result = getAnnotationsToUntriggerAfterSeek(annotations, 2000);

    expect(result).toEqual(['a3', 'a4']);
    expect(result).not.toContain('a2');
  });
});
