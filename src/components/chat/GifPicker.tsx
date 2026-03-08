import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X, Clock, TrendingUp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import {
  fetchTrendingGifs,
  searchGifs,
  fetchRecentGifs,
  shareGif,
  type KlipyGif,
} from "@/lib/klipyApi";

interface GifPickerProps {
  children: React.ReactNode;
  onSelect: (url: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "trending" | "recent";

const GIF_GRID_SKELETON = Array.from({ length: 9 });

/** Pick the best URL for grid thumbnails (small webp/gif). */
function getThumbnailUrl(gif: KlipyGif): string {
  return (
    gif.file?.sm?.webp?.url ||
    gif.file?.sm?.gif?.url ||
    gif.file?.md?.webp?.url ||
    gif.file?.md?.gif?.url ||
    gif.file?.hd?.gif?.url ||
    ""
  );
}

/** Pick the best URL for the sent message (high quality). */
function getOriginalUrl(gif: KlipyGif): string {
  return (
    gif.file?.hd?.gif?.url ||
    gif.file?.md?.gif?.url ||
    getThumbnailUrl(gif)
  );
}

export const GifPicker = ({ children, onSelect, open, onOpenChange }: GifPickerProps) => {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<Tab>("trending");
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [recentGifs, setRecentGifs] = useState<KlipyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch trending GIFs when the picker opens
  useEffect(() => {
    if (!open) return;

    console.log("[GifPicker] useEffect fired, open:", open, "user:", user?.id);
    setLoading(true);
    fetchTrendingGifs(24, user?.id)
      .then((result) => {
        console.log("[GifPicker] Got trending result, count:", result.length);
        setGifs(result);
      })
      .catch((err) => {
        console.error("[GifPicker] Failed to load trending:", err);
        setGifs([]);
      })
      .finally(() => setLoading(false));
  }, [open, user?.id]);

  // Fetch recent GIFs when "recent" tab is selected
  useEffect(() => {
    if (!open || tab !== "recent" || !user?.id) return;

    setRecentLoading(true);
    fetchRecentGifs(user.id)
      .then(setRecentGifs)
      .catch(() => setRecentGifs([]))
      .finally(() => setRecentLoading(false));
  }, [open, tab, user?.id]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        // Revert to trending
        setLoading(true);
        fetchTrendingGifs(24, user?.id)
          .then(setGifs)
          .catch(() => setGifs([]))
          .finally(() => setLoading(false));
        return;
      }

      debounceRef.current = setTimeout(() => {
        setLoading(true);
        searchGifs(value.trim(), 24, user?.id)
          .then(setGifs)
          .catch(() => setGifs([]))
          .finally(() => setLoading(false));
      }, 300);
    },
    [user?.id],
  );

  const handleGifClick = useCallback(
    (gif: KlipyGif) => {
      const url = getOriginalUrl(gif);
      if (!url) return;
      onSelect(url);
      onOpenChange(false);
      // Fire-and-forget share trigger
      if (gif.slug) {
        shareGif(gif.slug, user?.id);
      }
    },
    [onSelect, onOpenChange, user?.id],
  );

  // Reset state when closing
  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("trending");
    }
  }, [open]);

  const displayGifs = tab === "recent" ? recentGifs : gifs;
  const isLoading = tab === "recent" ? recentLoading : loading;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[320px] sm:w-[380px] p-0 bg-card border-border/50 rounded-2xl shadow-2xl overflow-hidden"
        side="top"
        align="end"
        sideOffset={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Tab bar */}
        <div className="flex border-b border-border/30">
          <button
            type="button"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
              tab === "trending"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("trending")}
          >
            <TrendingUp className="w-4 h-4" />
            Trending
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2",
              tab === "recent"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTab("recent")}
          >
            <Clock className="w-4 h-4" />
            Recent
          </button>
        </div>

        {/* Search bar (trending tab only) */}
        {tab === "trending" && (
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search GIFs..."
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30 focus:bg-muted/40 transition-all"
              />
              {query && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => handleSearchChange("")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* GIF Grid */}
        <ScrollArea className="h-[280px] sm:h-[320px]">
          <div className="p-2 sm:p-3">
            {isLoading ? (
              <div className="grid grid-cols-3 gap-1.5">
                {GIF_GRID_SKELETON.map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : displayGifs.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5">
                {displayGifs.map((gif) => (
                  <button
                    key={gif.id}
                    type="button"
                    className="aspect-square rounded-lg overflow-hidden hover:ring-2 ring-primary/60 transition-all focus:outline-none focus:ring-2 focus:ring-primary/60"
                    onClick={() => handleGifClick(gif)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <img
                      src={getThumbnailUrl(gif)}
                      alt={gif.title || "GIF"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : tab === "recent" ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No recent GIFs</p>
                <p className="text-xs text-muted-foreground/60 mt-1">GIFs you send will appear here</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No GIFs found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try a different search term</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Klipy Attribution */}
        <div className="px-3 py-2 border-t border-border/30 flex items-center justify-center">
          <a
            href="https://klipy.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Powered by KLIPY
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
};
