import { useEffect, useRef, useState, useCallback } from 'react';
import rrwebPlayer from 'rrweb-player';
import { decode } from '@toon-format/toon';
import 'rrweb-player/dist/style.css';

interface RrwebPlayerProps {
  recordingUrl: string;
}

interface RecordingDimensions {
  width: number;
  height: number;
}

type PlayerInstance = rrwebPlayer & { $destroy?: () => void };

const MIN_DISPLAY_WIDTH = 200;
const MIN_DISPLAY_HEIGHT = 150;

export function RrwebPlayer({ recordingUrl }: RrwebPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const eventsRef = useRef<unknown[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [recordingDimensions, setRecordingDimensions] = useState<RecordingDimensions | null>(null);
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);
  const [tooSmall, setTooSmall] = useState(false);
  const [ready, setReady] = useState(false);

  const calculateSize = useCallback(() => {
    if (!recordingDimensions || !wrapperRef.current) return;

    const availableWidth = wrapperRef.current.clientWidth;
    const availableHeight = wrapperRef.current.clientHeight;

    if (availableWidth < MIN_DISPLAY_WIDTH || availableHeight < MIN_DISPLAY_HEIGHT) {
      setTooSmall(true);
      setPlayerSize(null);
      return;
    }

    setTooSmall(false);

    const scaleX = availableWidth / recordingDimensions.width;
    const scaleY = availableHeight / recordingDimensions.height;
    const scale = Math.min(scaleX, scaleY);

    setPlayerSize({
      width: Math.floor(recordingDimensions.width * scale),
      height: Math.floor(recordingDimensions.height * scale),
    });
  }, [recordingDimensions]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const distanceFromBottom = window.innerHeight - e.clientY;
      setShowControls(distanceFromBottom < 100);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    calculateSize();

    const handleResize = () => calculateSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateSize]);

  // Create player when container is ready and we have size
  useEffect(() => {
    if (!ready || !containerRef.current || !eventsRef.current || !playerSize) return;

    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.$destroy?.();
    }

    containerRef.current.innerHTML = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playerRef.current = new rrwebPlayer({
      target: containerRef.current,
      props: {
        events: eventsRef.current as any,
        showController: true,
        autoPlay: false,
        width: playerSize.width,
        height: playerSize.height,
      },
    });
  }, [ready, playerSize]);

  useEffect(() => {
    async function loadRecording() {
      try {
        setLoading(true);
        setError(null);
        setReady(false);

        const response = await fetch(recordingUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch recording: ${response.statusText}`);
        }

        let data;
        if (recordingUrl.endsWith('.toon')) {
          const text = await response.text();
          data = decode(text, { strict: false, indent: 2 });
        } else if (recordingUrl.endsWith('.gz')) {
          const decompressedStream = response.body!.pipeThrough(
            new DecompressionStream('gzip')
          );
          const decompressedResponse = new Response(decompressedStream);
          data = await decompressedResponse.json();
        } else {
          data = await response.json();
        }

        // Handle both raw event arrays and wrapped {events: [...]} format
        const events = Array.isArray(data) ? data : (data as { events: unknown[] }).events;
        eventsRef.current = events;

        // Extract recording dimensions from meta event (type 4)
        const metaEvent = events.find((e: { type: number }) => e.type === 4);
        if (metaEvent?.data?.width && metaEvent?.data?.height) {
          setRecordingDimensions({
            width: metaEvent.data.width,
            height: metaEvent.data.height,
          });
        }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
        setLoading(false);
      }
    }

    loadRecording();

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
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      setReady(true);
    }
  }, []);

  const showPlayer = !loading && !error && !tooSmall;

  return (
    <div className="rrweb-player-wrapper" ref={wrapperRef}>
      {loading && <div className="loading">Loading recording...</div>}
      {error && <div className="error">Error: {error}</div>}
      {tooSmall && !loading && !error && (
        <div className="too-small">
          Browser window is too small to display the recording.
          Please resize your window.
        </div>
      )}
      {showPlayer && (
        <div
          ref={containerCallbackRef}
          className={`player-container ${showControls ? 'show-controls' : ''}`}
        />
      )}
    </div>
  );
}