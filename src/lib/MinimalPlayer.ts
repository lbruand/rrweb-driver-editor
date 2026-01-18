import { Replayer } from 'rrweb';
import type { eventWithTime } from '@rrweb/types';

export interface MinimalPlayerProps {
  events: eventWithTime[];
  showController?: boolean;
  autoPlay?: boolean;
  width?: number;
  height?: number;
}

interface RecordingMeta {
  width: number;
  height: number;
}

export interface MinimalPlayerConfig {
  target: HTMLElement;
  props: MinimalPlayerProps;
}

/**
 * Minimal player wrapper around rrweb's Replayer.
 * Provides similar API to rrweb-player without the Svelte dependency.
 */
export default class MinimalPlayer {
  private replayer: Replayer;
  private wrapper: HTMLDivElement;
  private controller: HTMLDivElement | null = null;
  private progressStep: HTMLDivElement | null = null;
  private progressHandler: HTMLDivElement | null = null;
  private timeDisplay: HTMLSpanElement | null = null;
  private playButton: HTMLButtonElement | null = null;
  private updateInterval: number | null = null;
  private totalTime: number = 0;
  private isDragging: boolean = false;
  private isPlaying: boolean = false;

  constructor(config: MinimalPlayerConfig) {
    const { target, props } = config;
    const { events, showController = true, autoPlay = false, width, height } = props;

    // Get recording dimensions from meta event
    const metaEvent = events.find((e) => e.type === 4) as { data?: RecordingMeta } | undefined;
    const recordingWidth = metaEvent?.data?.width || 1920;
    const recordingHeight = metaEvent?.data?.height || 1080;

    // Create .rr-player wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'rr-player';
    if (width) this.wrapper.style.width = `${width}px`;
    if (height) this.wrapper.style.height = `${height}px`;

    // Create .rr-player__frame
    const frame = document.createElement('div');
    frame.className = 'rr-player__frame';
    if (width) frame.style.width = `${width}px`;
    if (height) frame.style.height = `${height}px`;
    this.wrapper.appendChild(frame);

    // Create Replayer inside the frame
    this.replayer = new Replayer(events, {
      root: frame,
      skipInactive: true,
      showWarning: false,
      showDebug: false,
    });

    // Initialize replayer at time 0 (required before play() works)
    this.replayer.pause(0);

    // Apply scale transform to fit the recording in the frame
    if (width && height) {
      const scaleX = width / recordingWidth;
      const scaleY = height / recordingHeight;
      const scale = Math.min(scaleX, scaleY);

      const replayerWrapper = frame.querySelector('.replayer-wrapper') as HTMLElement;
      if (replayerWrapper) {
        replayerWrapper.style.transform = `scale(${scale})`;
        replayerWrapper.style.transformOrigin = 'top left';
      }
    }

    // Calculate total duration
    const meta = this.replayer.getMetaData();
    this.totalTime = meta.endTime - meta.startTime;

    // Append to target
    target.appendChild(this.wrapper);

    // Create controller if requested (append to body for guaranteed click handling)
    if (showController) {
      this.createController();
      document.body.appendChild(this.controller!);
      this.startProgressUpdates();
    }

    // Auto-play if requested
    if (autoPlay) {
      this.replayer.play();
      this.isPlaying = true;
    }
  }

  private createController(): void {
    this.controller = document.createElement('div');
    this.controller.className = 'rr-controller';

    // Timeline container
    const timeline = document.createElement('div');
    timeline.className = 'rr-timeline';

    // Time display
    this.timeDisplay = document.createElement('span');
    this.timeDisplay.className = 'rr-timeline__time';
    this.timeDisplay.textContent = this.formatTime(0) + ' / ' + this.formatTime(this.totalTime);

    // Progress bar
    const progress = document.createElement('div');
    progress.className = 'rr-progress';

    this.progressStep = document.createElement('div');
    this.progressStep.className = 'rr-progress__step';

    this.progressHandler = document.createElement('div');
    this.progressHandler.className = 'rr-progress__handler';

    progress.appendChild(this.progressStep);
    progress.appendChild(this.progressHandler);

    // Progress bar click/drag handling
    progress.addEventListener('mousedown', this.handleProgressMouseDown.bind(this));
    document.addEventListener('mousemove', this.handleProgressMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleProgressMouseUp.bind(this));

    timeline.appendChild(this.timeDisplay);
    timeline.appendChild(progress);

    // Buttons container
    const btns = document.createElement('div');
    btns.className = 'rr-controller__btns';

    // Play/Pause button
    this.playButton = document.createElement('button');
    this.playButton.type = 'button';
    this.playButton.className = 'rr-play-pause-btn';
    this.playButton.innerHTML = this.getPlayIcon();

    // Use mouseup in capture phase - more reliable than click
    const handlePlayPause = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.togglePlayPause();
    };

    this.playButton.addEventListener('mouseup', handlePlayPause, { capture: true });
    this.playButton.addEventListener('touchend', handlePlayPause, { capture: true });
    // Keep click for programmatic .click() calls (spacebar)
    this.playButton.addEventListener('click', (e) => {
      // Only handle if not already handled by mouseup
      if (e.isTrusted === false) {
        handlePlayPause(e);
      }
    });

    btns.appendChild(this.playButton);

    this.controller.appendChild(timeline);
    this.controller.appendChild(btns);
  }

  private handleProgressMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.seekToPosition(e);
  }

  private handleProgressMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      this.seekToPosition(e);
    }
  }

  private handleProgressMouseUp(): void {
    this.isDragging = false;
  }

  private seekToPosition(e: MouseEvent): void {
    const progress = this.controller?.querySelector('.rr-progress') as HTMLElement;
    if (!progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = percent * this.totalTime;

    this.replayer.pause(time);
    this.isPlaying = false;
    this.updateProgress();
    this.updatePlayButton();
  }

  private togglePlayPause(): void {
    if (this.isPlaying) {
      this.replayer.pause();
      this.isPlaying = false;
    } else {
      // Resume from current position (play() without args starts from 0)
      const currentTime = this.replayer.getCurrentTime();
      this.replayer.play(currentTime);
      this.isPlaying = true;
    }
    this.updatePlayButton();
  }

  private updatePlayButton(): void {
    if (!this.playButton) return;
    this.playButton.innerHTML = this.isPlaying ? this.getPauseIcon() : this.getPlayIcon();
  }

  private getPlayIcon(): string {
    return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="pointer-events: none;">
      <path d="M4 2l10 6-10 6V2z"/>
    </svg>`;
  }

  private getPauseIcon(): string {
    return `<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="pointer-events: none;">
      <path d="M3 2h4v12H3V2zm6 0h4v12H9V2z"/>
    </svg>`;
  }

  private startProgressUpdates(): void {
    this.updateInterval = window.setInterval(() => {
      this.updateProgress();
      this.updatePlayButton();
    }, 50);
  }

  private updateProgress(): void {
    const currentTime = this.replayer.getCurrentTime();
    const percent = this.totalTime > 0 ? (currentTime / this.totalTime) * 100 : 0;

    if (this.progressStep) {
      this.progressStep.style.width = `${percent}%`;
    }
    if (this.progressHandler) {
      this.progressHandler.style.left = `${percent}%`;
    }
    if (this.timeDisplay) {
      this.timeDisplay.textContent = this.formatTime(currentTime) + ' / ' + this.formatTime(this.totalTime);
    }
  }

  private formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  pause(): void {
    this.replayer.pause();
    this.isPlaying = false;
    this.updatePlayButton();
  }

  play(): void {
    // Resume from current position (play() without args starts from 0)
    const currentTime = this.replayer.getCurrentTime();
    this.replayer.play(currentTime);
    this.isPlaying = true;
    this.updatePlayButton();
  }

  goto(timeOffset: number, play?: boolean): void {
    if (play) {
      this.replayer.play(timeOffset);
      this.isPlaying = true;
    } else {
      this.replayer.pause(timeOffset);
      this.isPlaying = false;
    }
    this.updatePlayButton();
  }

  getReplayer(): Replayer {
    return this.replayer;
  }

  showController(): void {
    this.controller?.classList.add('visible');
  }

  hideController(): void {
    this.controller?.classList.remove('visible');
  }

  $destroy(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
    }
    document.removeEventListener('mousemove', this.handleProgressMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleProgressMouseUp.bind(this));
    this.replayer.destroy();
    this.wrapper.remove();
    this.controller?.remove();
  }
}
