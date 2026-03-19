import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Square } from "lucide-react";

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

export const AudioPlayer = memo(function AudioPlayer({ src, fileName, fileSize, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current;
      if (!audio || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audio.currentTime = ratio * duration;
      setCurrentTime(audio.currentTime);
    },
    [duration],
  );

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const sizeLabel = fileSize
    ? fileSize >= 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSize / 1024)} KB`
    : null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm max-w-[380px] p-4 space-y-3">
      <audio ref={audioRef} src={src} preload="metadata" onError={onError} />

      {/* Top row: play button + file info */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
          style={{
            backgroundColor: isPlaying
              ? "hsl(var(--kloak-dnd) / 0.15)"
              : "hsl(var(--kloak-online) / 0.15)",
          }}
        >
          {isPlaying ? (
            <Square
              className="w-4 h-4"
              style={{ color: "hsl(var(--kloak-dnd))" }}
              fill="hsl(var(--kloak-dnd))"
            />
          ) : (
            <Play
              className="w-4 h-4 ml-0.5"
              style={{ color: "hsl(var(--kloak-online))" }}
              fill="hsl(var(--kloak-online))"
            />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground/90 truncate leading-tight">
            {fileName}
          </p>
          {sizeLabel && (
            <p className="text-[11px] text-muted-foreground/60 leading-tight mt-0.5">
              {sizeLabel}
            </p>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground/50 tabular-nums flex-shrink-0">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-1 rounded-full bg-muted/50 cursor-pointer group"
        onClick={handleSeek}
      >
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${progress}%`,
            backgroundColor: isPlaying
              ? "hsl(var(--kloak-dnd))"
              : "hsl(var(--kloak-online))",
          }}
        />
      </div>
    </div>
  );
});
