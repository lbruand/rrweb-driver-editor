import { useEffect, useRef, useState, useCallback } from 'react';
import rrwebPlayer from 'rrweb-player';
import { decode } from '@toon-format/toon';
import 'rrweb-player/dist/style.css';
import { useAnnotations } from '../hooks/useAnnotations';
import { AnnotationMarkers } from './AnnotationMarkers';
import { TableOfContents } from './TableOfContents';
import { AnnotationOverlay } from './AnnotationOverlay';
import type { Annotation } from '../types/annotations';
import {DEFAULT_AUTOPAUSE} from "../constants/annotations.ts";

interface RrwebPlayerProps {
  recordingUrl: string;
  annotationsUrl?: string;
}

interface RecordingDimensions {
  width: number;
  height: number;
}

type PlayerInstance = rrwebPlayer & {
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

const MIN_DISPLAY_WIDTH = 200;
const MIN_DISPLAY_HEIGHT = 150;
const ANNOTATION_THRESHOLD_MS = 100;

export function RrwebPlayer({ recordingUrl, annotationsUrl }: RrwebPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const eventsRef = useRef<unknown[] | null>(null);
  const triggeredAnnotationsRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  const [recordingDimensions, setRecordingDimensions] = useState<RecordingDimensions | null>(null);
  const [playerSize, setPlayerSize] = useState<{ width: number; height: number } | null>(null);
  const [tooSmall, setTooSmall] = useState(false);
  const [ready, setReady] = useState(false);

  // Annotation state
  const { annotations, sections, title } = useAnnotations(annotationsUrl);
  const [tocOpen, setTocOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null);
  const [totalDuration, setTotalDuration] = useState(0);
  const [iframeElement, setIframeElement] = useState<HTMLIFrameElement | null>(null);

  // Update page title from annotations
  useEffect(() => {
    if (title) {
      document.title = `rehearseur - ${title}`;
    }
  }, [title]);

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

  const goToAnnotation = useCallback((annotation: Annotation) => {
    if (playerRef.current) {
      playerRef.current.goto(annotation.timestamp);
      triggeredAnnotationsRef.current.clear();
    }
  }, []);

  // Navigate to bookmark from URL hash (on page load and when hash changes)
  useEffect(() => {
    const handleHashChange = () => {
      if (!playerRef.current || annotations.length === 0) return;

      const hash = window.location.hash.slice(1); // Remove the '#'
      if (!hash) return;

      // Find annotation by ID
      const annotation = annotations.find(a => a.id === hash);
      if (annotation) {
        setActiveAnnotation(null); // Dismiss any active overlay
        goToAnnotation(annotation);
      }
    };

    // Navigate on initial load if there's a hash
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [annotations, goToAnnotation]);

  // Update URL hash based on current playback position
  useEffect(() => {
    if (annotations.length === 0) return;

    // Find the active annotation (last annotation before or at current time)
    let activeAnnotationId: string | null = null;
    for (const annotation of annotations) {
      if (annotation.timestamp <= currentTime) {
        activeAnnotationId = annotation.id;
      } else {
        break;
      }
    }

    // Update URL hash if changed
    const currentHash = window.location.hash.slice(1);
    if (activeAnnotationId && activeAnnotationId !== currentHash) {
      window.history.replaceState(null, '', `#${activeAnnotationId}`);
    } else if (!activeAnnotationId && currentHash) {
      // Clear hash if before first annotation
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [currentTime, annotations]);

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

  // Keyboard shortcuts for navigation and playback
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
          const replayer = playerRef.current.getReplayer?.();
          if (replayer) {
            // Check if currently playing by examining the internal state
            // The rrweb player doesn't expose a direct isPaused() method,
            // so we'll call pause() which is idempotent, or we can track state
            // For simplicity, we'll just use the controller's play/pause button behavior
            const controller = containerRef.current?.querySelector('.rr-controller__btns button');
            if (controller instanceof HTMLElement) {
              controller.click();
            }
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
  }, [annotations, currentTime, goToAnnotation, iframeElement]);

  // Check for annotation triggers
  const checkAnnotationTriggers = useCallback(
    (time: number) => {
      // Detect seeking backward - reset triggered annotations
      if (time < lastTimeRef.current - 1000) {
        triggeredAnnotationsRef.current.clear();
      }
      lastTimeRef.current = time;

      for (const annotation of annotations) {
        const timeDiff = Math.abs(time - annotation.timestamp);
        if (
          timeDiff < ANNOTATION_THRESHOLD_MS &&
          !triggeredAnnotationsRef.current.has(annotation.id)
        ) {
          triggeredAnnotationsRef.current.add(annotation.id);

          if (annotation.autopause ?? DEFAULT_AUTOPAUSE) {
            playerRef.current?.pause();
          }

          if (annotation.driverJsCode) {
            setActiveAnnotation(annotation);
          }
        }
      }
    },
    [annotations]
  );

  // Poll for current time
  // Note: iframeElement is set after player creation, so using it as dependency
  // ensures this effect runs after the player is ready
  useEffect(() => {
    if (!playerRef.current || !iframeElement) return;

    const interval = setInterval(() => {
      const replayer = playerRef.current?.getReplayer?.();
      if (replayer?.getCurrentTime) {
        const time = replayer.getCurrentTime();
        setCurrentTime(time);
        checkAnnotationTriggers(time);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [checkAnnotationTriggers, iframeElement]);

  // Create player when container is ready and we have size
  useEffect(() => {
    if (!ready || !containerRef.current || !eventsRef.current || !playerSize) return;

    if (playerRef.current) {
      playerRef.current.pause();
      playerRef.current.$destroy?.();
    }

    containerRef.current.innerHTML = '';

    playerRef.current = new rrwebPlayer({
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
    }
    if (iframe) {
      setIframeElement(iframe);
    }

    // Get total duration
    if (replayer?.getMetaData) {
      const meta = replayer.getMetaData();
      setTotalDuration(meta.endTime - meta.startTime);
    }
  }, [ready, playerSize]);

  useEffect(() => {
    async function loadRecording() {
      try {
        setLoading(true);
        setError(null);
        setReady(false);

        const response = await fetch(recordingUrl);
        if (!response.ok) {
          setError(`Failed to fetch recording: ${response.statusText}`);
          setLoading(false);
          return;
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

  const handleDismissOverlay = useCallback(() => {
    setActiveAnnotation(null);
  }, []);

  const showPlayer = !loading && !error && !tooSmall;
  const hasAnnotations = annotations.length > 0;

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
        <>
          <div
            ref={containerCallbackRef}
            className={`player-container ${showControls ? 'show-controls' : ''}`}
          />
          {hasAnnotations && (
            <>
              <AnnotationMarkers
                annotations={annotations}
                totalDuration={totalDuration}
                onMarkerClick={goToAnnotation}
                showControls={showControls}
              />
              <TableOfContents
                sections={sections}
                annotations={annotations}
                title={title}
                currentTime={currentTime}
                onAnnotationClick={goToAnnotation}
                isOpen={tocOpen}
                onToggle={() => setTocOpen((v) => !v)}
              />
              <AnnotationOverlay
                activeAnnotation={activeAnnotation}
                iframeElement={iframeElement}
                onDismiss={handleDismissOverlay}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
