import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Pause, Maximize, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  onError?: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const VideoPlayer = memo(function VideoPlayer({ src, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

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
    video.muted = !video.muted;
    setIsMuted(video.muted);
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl overflow-hidden bg-black/90 max-w-[480px] group cursor-pointer"
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

      {/* Center play overlay when paused */}
      {!isPlaying && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20"
          onClick={togglePlay}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm"
            style={{ backgroundColor: "hsl(var(--kloak-online) / 0.25)" }}
          >
            <Play
              className="w-7 h-7 ml-0.5"
              style={{ color: "hsl(var(--kloak-online))" }}
              fill="hsl(var(--kloak-online))"
            />
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className="absolute bottom-0 left-0 right-0 transition-opacity duration-200"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        {/* Progress bar */}
        <div
          className="h-1 mx-3 mb-1 rounded-full bg-white/20 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); handleSeek(e); }}
        >
          <div
            className="h-full rounded-full bg-white/80 transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2 px-3 pb-2.5 pt-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="text-white/80 hover:text-white transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" fill="currentColor" />}
          </button>

          <span className="text-[11px] text-white/50 tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="text-white/60 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
            className="text-white/60 hover:text-white transition-colors"
          >
            <Maximize className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});
