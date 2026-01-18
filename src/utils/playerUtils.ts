import type { RecordingDimensions } from '../types/player';
import { MIN_DISPLAY_WIDTH, MIN_DISPLAY_HEIGHT } from '../types/player';

export interface PlayerSize {
  width: number;
  height: number;
  tooSmall: boolean;
}

export function calculatePlayerSize(
  recordingDimensions: RecordingDimensions,
  availableWidth: number,
  availableHeight: number
): PlayerSize {
  if (availableWidth < MIN_DISPLAY_WIDTH || availableHeight < MIN_DISPLAY_HEIGHT) {
    return { width: 0, height: 0, tooSmall: true };
  }

  const scaleX = availableWidth / recordingDimensions.width;
  const scaleY = availableHeight / recordingDimensions.height;
  const scale = Math.min(scaleX, scaleY);

  return {
    width: Math.floor(recordingDimensions.width * scale),
    height: Math.floor(recordingDimensions.height * scale),
    tooSmall: false,
  };
}

export interface LoadRecordingResult {
  events: unknown[];
  dimensions: RecordingDimensions | null;
}

export async function loadRecording(url: string): Promise<LoadRecordingResult> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch recording: ${response.statusText}`);
  }

  const data = await response.json();

  // Handle both raw event arrays and wrapped {events: [...]} format
  const events = Array.isArray(data) ? data : (data as { events: unknown[] }).events;

  // Extract recording dimensions from meta event (type 4)
  const metaEvent = events.find((e: { type: number }) => e.type === 4);
  const dimensions = metaEvent?.data?.width && metaEvent?.data?.height
    ? { width: metaEvent.data.width, height: metaEvent.data.height }
    : null;

  return { events, dimensions };
}

export function updateUrlHash(annotationId: string): void {
  const currentHash = window.location.hash.slice(1);
  if (annotationId !== currentHash) {
    window.history.replaceState(null, '', `#${annotationId}`);
  }
}

export function clearUrlHash(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

export function getHashFromUrl(): string | null {
  const hash = window.location.hash.slice(1);
  return hash || null;
}