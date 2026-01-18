import { useState, useEffect, useRef, useCallback } from 'react';
import MinimalPlayer from '../lib/MinimalPlayer';
import '../lib/player.css';
import type { PlayerInstance, RecordingDimensions } from '../types/player';
import { loadRecording, calculatePlayerSize } from '../utils/playerUtils';
import { CONFIG } from '../constants/config';
import { useEventListener } from './useEventListener';

export interface UsePlayerInstanceResult {
  playerRef: React.RefObject<PlayerInstance | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerCallbackRef: (node: HTMLDivElement | null) => void;
  wrapperRef: React.RefObject<HTMLDivElement>;
  loading: boolean;
  error: string | null;
  tooSmall: boolean;
  iframeElement: HTMLIFrameElement | null;
  totalDuration: number;
  showControls: boolean;
  setShowControls: (show: boolean) => void;
}

export function usePlayerInstance(recordingUrl: string): UsePlayerInstanceResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null!);
  const playerRef = useRef<PlayerInstance | null>(null);
  const eventsRef = useRef<unknown[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [recordingDimensions, setRecordingDimensions] = useState<RecordingDimensions | null>(null);
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);
  const [tooSmall, setTooSmall] = useState(false);
  const [ready, setReady] = useState(false);
  const [iframeElement, setIframeElement] = useState<HTMLIFrameElement | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);

  // Calculate player size based on recording dimensions and available space
  const calculateSize = useCallback(() => {
    if (!recordingDimensions || !wrapperRef.current) return;

    const availableWidth = wrapperRef.current.clientWidth;
    const availableHeight = wrapperRef.current.clientHeight;

    const result = calculatePlayerSize(recordingDimensions, availableWidth, availableHeight);

    setTooSmall(result.tooSmall);
    if (result.tooSmall) {
      setPlayerSize(null);
    } else {
      setPlayerSize({ width: result.width, height: result.height });
    }
  }, [recordingDimensions]);

  // Handle mouse move to show/hide controls
  useEventListener('mousemove', (e) => {
    const distanceFromBottom = window.innerHeight - e.clientY;
    setShowControls(distanceFromBottom < CONFIG.UI.MOUSE_CONTROLS_DISTANCE_PX);
  });

  // Handle window resize
  useEventListener('resize', calculateSize);

  // Calculate size on mount
  useEffect(() => {
    calculateSize();
  }, [calculateSize]);

  // Load recording
  useEffect(() => {
    async function loadRec() {
      try {
        setLoading(true);
        setError(null);
        setReady(false);

        const { events, dimensions } = await loadRecording(recordingUrl);
        eventsRef.current = events;

        if (dimensions) {
          setRecordingDimensions(dimensions);
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
        setLoading(false);
      }
    }

    loadRec();

    return () => {
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.$destroy?.();
        playerRef.current = null;
      }
    };
  }, [recordingUrl]);

  // Set ready when container is mounted
  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      containerRef.current = node;
      setReady(true);
    }
  }, []);

  // Create player when container is ready and we have size
  useEffect(() => {
    if (!ready || !containerRef.current || !eventsRef.current || !playerSize) return;

    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.$destroy?.();
    }

    containerRef.current.innerHTML = '';

    playerRef.current = new MinimalPlayer({
      target: containerRef.current,
      props: {
        // @ts-expect-error events type mismatch between unknown[] and eventWithTime[]
        events: eventsRef.current,
        showController: true,
        autoPlay: false,
        width: playerSize.width,
        height: playerSize.height,
      },
    });

    // Get iframe element for driver.js
    const replayer = playerRef.current.getReplayer?.();
    const iframe = replayer?.iframe;

    // Remove sandbox attribute - we trust the recording input
    if (iframe) {
      iframe.removeAttribute('sandbox');
      // Defer setState to avoid synchronous update in effect
      requestAnimationFrame(() => {
        setIframeElement(iframe);
      });
    }

    // Get total duration
    if (replayer?.getMetaData) {
      const meta = replayer.getMetaData();
      // Defer setState to avoid synchronous update in effect
      requestAnimationFrame(() => {
        setTotalDuration(meta.endTime - meta.startTime);
      });
    }
  }, [ready, playerSize]);

  // Expose containerCallbackRef by setting it via effect
  useEffect(() => {
    if (wrapperRef.current) {
      const observer = new MutationObserver(() => {
        const container = wrapperRef.current?.querySelector('.player-container');
        if (container) {
          containerCallbackRef(container as HTMLDivElement);
        }
      });
      observer.observe(wrapperRef.current, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [containerCallbackRef]);

  // Sync controller visibility with showControls state
  useEffect(() => {
    if (playerRef.current) {
      if (showControls) {
        playerRef.current.showController();
      } else {
        playerRef.current.hideController();
      }
    }
  }, [showControls]);

  return {
    playerRef,
    containerRef,
    containerCallbackRef,
    wrapperRef,
    loading,
    error,
    tooSmall,
    iframeElement,
    totalDuration,
    showControls,
    setShowControls,
  };
}