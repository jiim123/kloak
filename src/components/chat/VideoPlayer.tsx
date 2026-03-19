import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Pause, Maximize, Volume2, VolumeX, Volume1, Film } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  fileName?: string;
  uploaderName?: string;
  onError?: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <VolumeX className="w-5 h-5" />;
  if (volume < 0.5) return <Volume1 className="w-5 h-5" />;
  return <Volume2 className="w-5 h-5" />;
}

function useDraggableSlider(onChange: (ratio: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const getRatio = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    onChange(getRatio(e.clientX));

    const onMove = (ev: MouseEvent) => {
      if (dragging.current) onChange(getRatio(ev.clientX));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onChange, getRatio]);

  return { ref, onMouseDown };
}

export const VideoPlayer = memo(function VideoPlayer({ src, fileName, uploaderName, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const prevVolumeRef = useRef(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => { setIsPlaying(false); setShowControls(true); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [src]);

  const scheduleHide = useCallback(() => {
    if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    setShowControls(true);
    hideTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setShowControls(false);
      }
    }, 2500);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      scheduleHide();
    } else {
      video.pause();
      setShowControls(true);
    }
  }, [scheduleHide]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted || volume === 0) {
      const restore = prevVolumeRef.current || 1;
      video.muted = false;
      video.volume = restore;
      setIsMuted(false);
      setVolume(restore);
    } else {
      prevVolumeRef.current = volume;
      video.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const applyVolume = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = ratio;
    video.muted = ratio === 0;
    setVolume(ratio);
    setIsMuted(ratio === 0);
    if (ratio > 0) prevVolumeRef.current = ratio;
  }, []);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = ratio * duration;
      setCurrentTime(video.currentTime);
    },
    [duration],
  );

  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
  }, []);

  const volumeSlider = useDraggableSlider(applyVolume);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-black/90 max-w-[480px] group cursor-pointer border border-border/60"
      onMouseMove={scheduleHide}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        className="w-full max-h-[360px] block"
        onClick={togglePlay}
        onError={onError}
      />

      {/* Top bar: duration badge */}
      {duration > 0 && (
        <div
          className="absolute top-0 right-0 px-3 pt-3 transition-opacity duration-200"
          style={{ opacity: showControls || !isPlaying ? 1 : 0 }}
        >
          <div className="bg-black/50 backdrop-blur-sm rounded-md px-2 py-0.5">
            <span className="text-[11px] text-white/80 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 transition-opacity duration-200 bg-gradient-to-t from-black/60 to-transparent pt-8"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}
      >
        {/* Progress bar */}
        <div
          className="h-1.5 mx-4 mb-2 rounded-full bg-white/20 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
        >
          <div
            className="h-full rounded-full bg-white/80 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5 px-2 pb-3 pt-0.5">
          {/* Play/Pause */}
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" fill="currentColor" />}
          </button>

          {/* Volume group — always visible */}
          <div className="flex items-center">
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <VolumeIcon volume={volume} muted={isMuted} />
            </button>

            <div
              ref={volumeSlider.ref}
              className="h-1.5 w-[72px] ml-1 rounded-full bg-white/20 cursor-pointer flex-shrink-0 select-none"
              onMouseDown={volumeSlider.onMouseDown}
            >
              <div
                className="h-full rounded-full bg-white/70 transition-[width] duration-75 pointer-events-none"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-white/60 tabular-nums ml-1.5 w-[28px] text-right flex-shrink-0">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>

          <div className="flex-1" />

          {/* Fullscreen */}
          <button
            onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Maximize className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
});
