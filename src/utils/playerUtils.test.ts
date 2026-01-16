/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  calculatePlayerSize,
  loadRecording,
  updateUrlHash,
  clearUrlHash,
  getHashFromUrl,
} from './playerUtils';
import type { RecordingDimensions } from '../types/player';

describe('calculatePlayerSize', () => {
  it('should calculate size that fits within available space', () => {
    const recordingDimensions: RecordingDimensions = { width: 1920, height: 1080 };
    const result = calculatePlayerSize(recordingDimensions, 1000, 600);

    expect(result.tooSmall).toBe(false);
    expect(result.width).toBeLessThanOrEqual(1000);
    expect(result.height).toBeLessThanOrEqual(600);
  });

  it('should maintain aspect ratio when scaling', () => {
    const recordingDimensions: RecordingDimensions = { width: 1920, height: 1080 };
    const result = calculatePlayerSize(recordingDimensions, 1000, 600);

    const originalRatio = recordingDimensions.width / recordingDimensions.height;
    const scaledRatio = result.width / result.height;

    // Allow small floating point differences
    expect(Math.abs(originalRatio - scaledRatio)).toBeLessThan(0.1);
  });

  it('should mark as too small when width is below minimum', () => {
    const recordingDimensions: RecordingDimensions = { width: 1920, height: 1080 };
    const result = calculatePlayerSize(recordingDimensions, 150, 600);

    expect(result.tooSmall).toBe(true);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('should mark as too small when height is below minimum', () => {
    const recordingDimensions: RecordingDimensions = { width: 1920, height: 1080 };
    const result = calculatePlayerSize(recordingDimensions, 1000, 100);

    expect(result.tooSmall).toBe(true);
    expect(result.width).toBe(0);
    expect(result.height).toBe(0);
  });

  it('should scale down proportionally when constrained by width', () => {
    const recordingDimensions: RecordingDimensions = { width: 2000, height: 1000 };
    const result = calculatePlayerSize(recordingDimensions, 1000, 2000);

    // Should be constrained by width, not height
    expect(result.width).toBe(1000);
    expect(result.height).toBe(500);
  });

  it('should scale down proportionally when constrained by height', () => {
    const recordingDimensions: RecordingDimensions = { width: 1000, height: 2000 };
    const result = calculatePlayerSize(recordingDimensions, 2000, 1000);

    // Should be constrained by height, not width
    expect(result.width).toBe(500);
    expect(result.height).toBe(1000);
  });

  it('should handle square recordings', () => {
    const recordingDimensions: RecordingDimensions = { width: 1000, height: 1000 };
    const result = calculatePlayerSize(recordingDimensions, 800, 800);

    expect(result.tooSmall).toBe(false);
    expect(result.width).toBe(800);
    expect(result.height).toBe(800);
  });

  it('should round down dimensions to integers', () => {
    const recordingDimensions: RecordingDimensions = { width: 1920, height: 1080 };
    const result = calculatePlayerSize(recordingDimensions, 999, 600);

    expect(result.width).toBe(Math.floor(result.width));
    expect(result.height).toBe(Math.floor(result.height));
    expect(Number.isInteger(result.width)).toBe(true);
    expect(Number.isInteger(result.height)).toBe(true);
  });
});

describe('loadRecording', () => {
  beforeEach(() => {
    global.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load a plain JSON recording', async () => {
    const mockEvents = [
      { type: 4, data: { width: 1920, height: 1080 } },
      { type: 2, data: {} },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    } as Response);

    const result = await loadRecording('http://example.com/recording.json');

    expect(result.events).toEqual(mockEvents);
    expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
  });

  it('should load a wrapped JSON recording', async () => {
    const mockEvents = [
      { type: 4, data: { width: 1920, height: 1080 } },
      { type: 2, data: {} },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: mockEvents }),
    } as Response);

    const result = await loadRecording('http://example.com/recording.json');

    expect(result.events).toEqual(mockEvents);
    expect(result.dimensions).toEqual({ width: 1920, height: 1080 });
  });

  it('should extract dimensions from meta event (type 4)', async () => {
    const mockEvents = [
      { type: 1, data: {} },
      { type: 4, data: { width: 2560, height: 1440 } },
      { type: 2, data: {} },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    } as Response);

    const result = await loadRecording('http://example.com/recording.json');

    expect(result.dimensions).toEqual({ width: 2560, height: 1440 });
  });

  it('should return null dimensions if no meta event', async () => {
    const mockEvents = [
      { type: 1, data: {} },
      { type: 2, data: {} },
    ];

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockEvents,
    } as Response);

    const result = await loadRecording('http://example.com/recording.json');

    expect(result.dimensions).toBeNull();
  });

  it('should throw error on failed fetch', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Response);

    await expect(loadRecording('http://example.com/missing.json')).rejects.toThrow(
      'Failed to fetch recording: Not Found'
    );
  });

  it('should handle network errors', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

    await expect(loadRecording('http://example.com/recording.json')).rejects.toThrow(
      'Network error'
    );
  });
});

describe('URL hash utilities', () => {
  beforeEach(() => {
    // Reset window location
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    window.location = {
      hash: '',
      pathname: '/test',
      href: 'http://localhost:5174/test',
    } as Location;

    // Mock history.replaceState
    window.history.replaceState = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHashFromUrl', () => {
    it('should return hash without # prefix', () => {
      window.location.hash = '#annotation-1';
      expect(getHashFromUrl()).toBe('annotation-1');
    });

    it('should return null when no hash', () => {
      window.location.hash = '';
      expect(getHashFromUrl()).toBeNull();
    });

    it('should handle hash with multiple # characters', () => {
      window.location.hash = '#annotation#with#hash';
      expect(getHashFromUrl()).toBe('annotation#with#hash');
    });
  });

  describe('updateUrlHash', () => {
    it('should update hash when different from current', () => {
      window.location.hash = '#old-annotation';
      updateUrlHash('new-annotation');

      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '#new-annotation'
      );
    });

    it('should not update hash when same as current', () => {
      window.location.hash = '#annotation-1';
      updateUrlHash('annotation-1');

      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it('should update empty hash', () => {
      window.location.hash = '';
      updateUrlHash('annotation-1');

      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '#annotation-1'
      );
    });
  });

  describe('clearUrlHash', () => {
    it('should clear the hash from URL', () => {
      window.location.hash = '#annotation-1';
      window.location.pathname = '/recording';

      clearUrlHash();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/recording'
      );
    });

    it('should work when hash is already empty', () => {
      window.location.hash = '';
      window.location.pathname = '/recording';

      clearUrlHash();

      expect(window.history.replaceState).toHaveBeenCalledWith(
        null,
        '',
        '/recording'
      );
    });
  });
});