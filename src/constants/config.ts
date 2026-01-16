/**
 * Application-wide configuration constants.
 * Consolidates magic numbers and strings for better maintainability.
 */

export const CONFIG = {
  RECORDING: {
    DEFAULT_URL: 'recording_jupyterlite.json',
    ANNOTATIONS_SUFFIX: '.annotations.md',
  },
  PLAYER: {
    DISPLAY_MIN_WIDTH: 200,
    DISPLAY_MIN_HEIGHT: 150,
    POLLING_INTERVAL_MS: 100,
  },
  ANNOTATIONS: {
    TRIGGER_THRESHOLD_MS: 100,
    SEEKING_BACKWARD_THRESHOLD_MS: 1000,
  },
  UI: {
    MOUSE_CONTROLS_DISTANCE_PX: 100,
    ANIMATION_DURATION_MS: 350,
    OVERLAY_OPACITY: 0.7,
  },
} as const;