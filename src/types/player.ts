import type { Replayer } from 'rrweb';
import { CONFIG } from '../constants/config';

export interface RecordingDimensions {
  width: number;
  height: number;
}

export interface PlayerInstance {
  pause: () => void;
  play: () => void;
  goto: (timeOffset: number, play?: boolean) => void;
  getReplayer: () => Replayer;
  showController: () => void;
  hideController: () => void;
  $destroy?: () => void;
}

// Re-export constants from CONFIG for backward compatibility
export const MIN_DISPLAY_WIDTH = CONFIG.PLAYER.DISPLAY_MIN_WIDTH;
export const MIN_DISPLAY_HEIGHT = CONFIG.PLAYER.DISPLAY_MIN_HEIGHT;
export const ANNOTATION_THRESHOLD_MS = CONFIG.ANNOTATIONS.TRIGGER_THRESHOLD_MS;