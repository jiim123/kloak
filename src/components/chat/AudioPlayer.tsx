import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Square, Volume2, VolumeX, Volume1, Music } from "lucide-react";

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
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const prevVolumeRef = useRef(1);
  const volumeHideRef = useRef<ReturnType<typeof setTimeout>>();

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

  const handleVolumeHover = useCallback((show: boolean) => {
    if (volumeHideRef.current) clearTimeout(volumeHideRef.current);
    if (show) {
      setShowVolumeSlider(true);
    } else {
      volumeHideRef.current = setTimeout(() => setShowVolumeSlider(false), 300);
    }
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const sizeLabel = fileSize
    ? fileSize >= 1024 * 1024
      ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSize / 1024)} KB`
    : null;

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm max-w-[400px] p-4 space-y-3">
      <audio ref={audioRef} src={src} preload="metadata" onError={onError} />

      {/* Top row: audio icon + file info + duration */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Music className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
          <span className="text-xs text-foreground/80 truncate">{fileName}</span>
          {sizeLabel && (
            <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">· {sizeLabel}</span>
          )}
        </div>
        {duration > 0 && (
          <div className="bg-muted/50 rounded-md px-2 py-0.5 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        )}
      </div>

      {/* Progress bar */}
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

      {/* Bottom controls: play + volume */}
      <div className="flex items-center gap-1">
        <button
          onClick={togglePlay}
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-muted/50"
          style={{
            color: isPlaying
              ? "hsl(var(--kloak-dnd))"
              : "hsl(var(--kloak-online))",
          }}
        >
          {isPlaying ? (
            <Square className="w-4 h-4" fill="currentColor" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
          )}
        </button>

        {/* Volume group */}
        <div
          className="relative flex items-center"
          onMouseEnter={() => handleVolumeHover(true)}
          onMouseLeave={() => handleVolumeHover(false)}
        >
          <button
            onClick={toggleMute}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/50 transition-colors"
          >
            <VolumeIcon volume={volume} muted={isMuted} className="w-4 h-4" />
          </button>

          <div
            className="overflow-hidden transition-all duration-200 ease-out"
            style={{ width: showVolumeSlider ? 80 : 0, opacity: showVolumeSlider ? 1 : 0 }}
          >
            <div
              className="h-1.5 w-[72px] ml-1 mr-1 rounded-full bg-muted/40 cursor-pointer flex-shrink-0"
              onClick={handleVolumeChange}
            >
              <div
                className="h-full rounded-full bg-muted-foreground/30 transition-[width] duration-75"
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
