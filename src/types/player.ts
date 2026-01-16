import type rrwebPlayer from 'rrweb-player';

export interface RecordingDimensions {
  width: number;
  height: number;
}

export type PlayerInstance = rrwebPlayer & {
  $destroy?: () => void;
  goto?: (timeOffset: number, play?: boolean) => void;
  getReplayer?: () => {
    iframe?: HTMLIFrameElement;
    getMetaData?: () => { startTime: number; endTime: number };
    getCurrentTime?: () => number;
    on?: (event: string, handler: (...args: unknown[]) => void) => void;
    off?: (event: string, handler: (...args: unknown[]) => void) => void;
  };
};

export const MIN_DISPLAY_WIDTH = 200;
export const MIN_DISPLAY_HEIGHT = 150;
export const ANNOTATION_THRESHOLD_MS = 100;