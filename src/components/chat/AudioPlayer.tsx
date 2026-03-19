import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Square, Volume2, VolumeX, Volume1 } from "lucide-react";

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

export const AudioPlayer = memo(function AudioPlayer({ src, fileName, fileSize, onError }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const prevVolumeRef = useRef(1);

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

  const handleVolumeChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.volume = ratio;
    audio.muted = ratio === 0;
    setVolume(ratio);
    setIsMuted(ratio === 0);
    if (ratio > 0) prevVolumeRef.current = ratio;
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const sizeLabel = fileSize
    ? fileSize >= 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSize / 1024)} KB`
    : null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm max-w-[400px] p-5 space-y-4">
      <audio ref={audioRef} src={src} preload="metadata" onError={onError} />

      {/* Top row: play button + file info */}
      <div className="flex items-center gap-3.5">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
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

      </div>

      {/* Progress bar + time */}
      <div>
        <div
          className="h-1.5 rounded-full bg-muted/50 cursor-pointer"
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
        <div className="flex justify-end mt-1.5">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Volume row */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleMute}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground/80 transition-colors"
        >
          <VolumeIcon volume={volume} muted={isMuted} className="w-4 h-4" />
        </button>
        <div
          className="flex-1 h-1.5 rounded-full bg-muted/40 cursor-pointer"
          onClick={handleVolumeChange}
        >
          <div
            className="h-full rounded-full bg-muted-foreground/30 transition-[width] duration-75"
            style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
});
