import { useEffect, useRef, useState } from 'react';
import rrwebPlayer from 'rrweb-player';
import 'rrweb-player/dist/style.css';

interface RrwebPlayerProps {
  recordingUrl: string;
}

type PlayerInstance = rrwebPlayer & { $destroy?: () => void };

export function RrwebPlayer({ recordingUrl }: RrwebPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecording() {
      if (!containerRef.current) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(recordingUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch recording: ${response.statusText}`);
        }

        let events;

        let data;
        if (recordingUrl.endsWith('.gz')) {
          const decompressedStream = response.body!.pipeThrough(
            new DecompressionStream('gzip')
          );
          const decompressedResponse = new Response(decompressedStream);
          data = await decompressedResponse.json();
        } else {
          data = await response.json();
        }

        // Handle both raw event arrays and wrapped {events: [...]} format
        events = Array.isArray(data) ? data : data.events;

        if (playerRef.current) {
          playerRef.current.pause();
          playerRef.current.$destroy?.();
        }

        containerRef.current.innerHTML = '';

        playerRef.current = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events,
            showController: true,
            autoPlay: false,
          },
        });

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

  return (
    <div className="rrweb-player-wrapper">
      {loading && <div className="loading">Loading recording...</div>}
      {error && <div className="error">Error: {error}</div>}
      <div ref={containerRef} className="player-container" />
    </div>
  );
}