import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Square, Volume2, VolumeX, Volume1, Music } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface AudioPlayerProps {
  src: string;
  fileName: string;
  fileSize?: number;
  onError?: () => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VolumeIcon({ volume, muted, className }: { volume: number; muted: boolean; className?: string }) {
  if (muted || volume === 0) return <VolumeX className={className} />;
  if (volume < 0.5) return <Volume1 className={className} />;
  return <Volume2 className={className} />;
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

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    onChange(getRatio(e.clientX));
  }, [onChange, getRatio]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragging.current) onChange(getRatio(e.clientX));
  }, [onChange, getRatio]);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return { ref, onPointerDown, onPointerMove, onPointerUp };
}

export const AudioPlayer = memo(function AudioPlayer({ src, fileName, fileSize, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const prevVolumeRef = useRef(1);
  const isMobile = useIsMobile();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const applySeek = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted || volume === 0) {
      const restore = prevVolumeRef.current || 1;
      audio.muted = false;
      audio.volume = restore;
      setIsMuted(false);
      setVolume(restore);
    } else {
      prevVolumeRef.current = volume;
      audio.muted = true;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const applyVolume = useCallback((ratio: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = ratio;
    audio.muted = ratio === 0;
    setVolume(ratio);
    setIsMuted(ratio === 0);
    if (ratio > 0) prevVolumeRef.current = ratio;
  }, []);

  const seekSlider = useDraggableSlider(applySeek);
  const volumeSlider = useDraggableSlider(applyVolume);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const sizeLabel = fileSize
    ? fileSize >= 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSize / 1024)} KB`
    : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm w-full max-w-[480px] min-w-0 p-3 sm:p-4 space-y-2.5 sm:space-y-3">
      <audio ref={audioRef} src={src} preload="metadata" onError={onError} />

      {/* Top row: audio icon + file info */}
      <div className="flex items-center gap-2 min-w-0">
        <Music className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-foreground/80 truncate flex-1 min-w-0">{fileName}</span>
        {sizeLabel && (
          <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">{sizeLabel}</span>
        )}
      </div>

      {/* Progress bar */}
      <div
        ref={seekSlider.ref}
        className="h-1.5 rounded-full bg-muted/50 cursor-pointer select-none touch-none"
        onPointerDown={seekSlider.onPointerDown}
        onPointerMove={seekSlider.onPointerMove}
        onPointerUp={seekSlider.onPointerUp}
      >
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear pointer-events-none"
          style={{
            width: `${progress}%`,
            backgroundColor: isPlaying
              ? "hsl(var(--kloak-dnd))"
              : "hsl(var(--kloak-online))",
          }}
        />
      </div>

      {/* Bottom controls: play + volume + time */}
      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-colors hover:bg-muted/50"
          style={{
            color: isPlaying
              ? "hsl(var(--kloak-dnd))"
              : "hsl(var(--kloak-online))",
          }}
        >
          {isPlaying ? (
            <Square className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" />
          ) : (
            <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" fill="currentColor" />
          )}
        </button>

        {/* Volume group — slider hidden on mobile */}
        <div className="flex items-center">
          <button
            onClick={toggleMute}
            className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <VolumeIcon volume={volume} muted={isMuted} className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {!isMobile && (
            <>
              <div
                ref={volumeSlider.ref}
                className="h-1.5 w-[72px] ml-1 rounded-full bg-muted/40 cursor-pointer flex-shrink-0 select-none touch-none"
                onPointerDown={volumeSlider.onPointerDown}
                onPointerMove={volumeSlider.onPointerMove}
                onPointerUp={volumeSlider.onPointerUp}
              >
                <div
                  className="h-full rounded-full bg-muted-foreground/50 transition-[width] duration-75 pointer-events-none"
                  style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums ml-1.5 w-[28px] text-right flex-shrink-0">
                {Math.round((isMuted ? 0 : volume) * 100)}%
              </span>
            </>
          )}
        </div>

        <div className="flex-1" />

        <span className="text-[10px] sm:text-[11px] text-muted-foreground tabular-nums pr-1">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
    </div>
  );
});
