import { useState, useEffect, useCallback, useRef } from "react";
import poweredByKlipy from "@/assets/powered-by-klipy.svg";
import { Search, X, Clock, TrendingUp, LayoutGrid } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  fetchTrendingGifs,
  searchGifs,
  fetchRecentGifs,
  fetchCategories,
  shareGif,
  type KlipyGif,
  type KlipyCategory,
} from "@/lib/klipyApi";

interface GifPickerProps {
  children: React.ReactNode;
  onSelect: (url: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = "trending" | "categories" | "recent";

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

/** Shared inner content for both Popover and Drawer */
function GifPickerContent({
  isMobile,
  tab,
  setTab,
  query,
  handleSearchChange,
  loading,
  gifs,
  recentGifs,
  recentLoading,
  categories,
  categoriesLoading,
  selectedCategory,
  handleCategoryClick,
  handleBackToCategories,
  handleGifClick,
  setSelectedCategory,
}: {
  isMobile: boolean;
  tab: Tab;
  setTab: (t: Tab) => void;
  query: string;
  handleSearchChange: (v: string) => void;
  loading: boolean;
  gifs: KlipyGif[];
  recentGifs: KlipyGif[];
  recentLoading: boolean;
  categories: KlipyCategory[];
  categoriesLoading: boolean;
  selectedCategory: string | null;
  handleCategoryClick: (q: string) => void;
  handleBackToCategories: () => void;
  handleGifClick: (gif: KlipyGif) => void;
  setSelectedCategory: (v: string | null) => void;
}) {
  const renderGifGrid = (gifList: KlipyGif[], isLoadingState: boolean, emptyIcon: React.ReactNode, emptyTitle: string, emptySubtitle: string) => {
    if (isLoadingState) {
      return (
        <div className={cn("grid gap-1.5", isMobile ? "grid-cols-3" : "grid-cols-3")}>
          {GIF_GRID_SKELETON.map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      );
    }
    if (gifList.length > 0) {
      return (
        <div className={cn("grid gap-1.5", isMobile ? "grid-cols-3" : "grid-cols-3")}>
          {gifList.map((gif) => (
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
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        {emptyIcon}
        <p className="text-sm font-medium text-muted-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{emptySubtitle}</p>
      </div>
    );
  };

  return (
    <>

      {/* Tab bar */}
      <div className="flex border-b border-border/30">
        {([
          { key: "trending" as Tab, icon: TrendingUp, label: "Trending" },
          { key: "categories" as Tab, icon: LayoutGrid, label: "Categories" },
          { key: "recent" as Tab, icon: Clock, label: "Recent" },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2",
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            onClick={() => {
              setTab(key);
              if (key === "categories") setSelectedCategory(null);
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
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

      {/* Content */}
      <ScrollArea className={isMobile ? "flex-1" : "h-[320px]"} style={isMobile ? { height: "calc(75vh - 140px)" } : undefined}>
        <div className="p-2 sm:p-3">
          {tab === "trending" && renderGifGrid(
            gifs, loading,
            <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />,
            "No GIFs found",
            "Try a different search term",
          )}

          {tab === "categories" && !selectedCategory && (
            categoriesLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.query}
                    type="button"
                    className="relative h-20 rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary/60"
                    onClick={() => handleCategoryClick(cat.query)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <img
                      src={cat.preview_url}
                      alt={cat.category}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                      <span className="text-white text-sm font-semibold capitalize drop-shadow-md">
                        {cat.category}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <LayoutGrid className="w-8 h-8 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No categories</p>
              </div>
            )
          )}

          {tab === "categories" && selectedCategory && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors"
                onClick={handleBackToCategories}
              >
                <X className="w-3.5 h-3.5" />
                <span className="capitalize">{selectedCategory}</span>
              </button>
              {renderGifGrid(
                gifs, loading,
                <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />,
                "No GIFs found",
                "Try another category",
              )}
            </div>
          )}

          {tab === "recent" && renderGifGrid(
            recentGifs, recentLoading,
            <Clock className="w-8 h-8 text-muted-foreground/30 mb-3" />,
            "No recent GIFs",
            "GIFs you send will appear here",
          )}
        </div>
      </ScrollArea>

      {/* Klipy Attribution */}
      <div className="px-3 py-2 border-t border-border/30 flex items-center justify-center">
        <a
          href="https://klipy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-60 hover:opacity-80 transition-opacity"
        >
          <img src={poweredByKlipy} alt="Powered by KLIPY" className="h-5" />
        </a>
      </div>
    </>
  );
}

export const GifPicker = ({ children, onSelect, open, onOpenChange }: GifPickerProps) => {
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<Tab>("trending");
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<KlipyGif[]>([]);
  const [recentGifs, setRecentGifs] = useState<KlipyGif[]>([]);
  const [categories, setCategories] = useState<KlipyCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchTrendingGifs(24, user?.id)
      .then(setGifs)
      .catch(() => setGifs([]))
      .finally(() => setLoading(false));
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || tab !== "recent" || !user?.id) return;
    setRecentLoading(true);
    fetchRecentGifs(user.id)
      .then(setRecentGifs)
      .catch(() => setRecentGifs([]))
      .finally(() => setRecentLoading(false));
  }, [open, tab, user?.id]);

  useEffect(() => {
    if (!open || tab !== "categories") return;
    if (categories.length > 0 && !selectedCategory) return;
    if (selectedCategory) {
      setLoading(true);
      searchGifs(selectedCategory, 24, user?.id)
        .then(setGifs)
        .catch(() => setGifs([]))
        .finally(() => setLoading(false));
    } else {
      setCategoriesLoading(true);
      fetchCategories()
        .then(setCategories)
        .catch(() => setCategories([]))
        .finally(() => setCategoriesLoading(false));
    }
  }, [open, tab, selectedCategory, user?.id]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
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
      if (gif.slug) shareGif(gif.slug, user?.id);
    },
    [onSelect, onOpenChange, user?.id],
  );

  const handleCategoryClick = useCallback((categoryQuery: string) => {
    setSelectedCategory(categoryQuery);
  }, []);

  const handleBackToCategories = useCallback(() => {
    setSelectedCategory(null);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setTab("trending");
      setSelectedCategory(null);
    }
  }, [open]);

  const contentProps = {
    isMobile: !!isMobile,
    tab,
    setTab,
    query,
    handleSearchChange,
    loading,
    gifs,
    recentGifs,
    recentLoading,
    categories,
    categoriesLoading,
    selectedCategory,
    handleCategoryClick,
    handleBackToCategories,
    handleGifClick,
    setSelectedCategory,
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="min-h-[40vh] max-h-[90vh] p-0 bg-card border-border/50 rounded-t-2xl overflow-hidden flex flex-col">
          <GifPickerContent {...contentProps} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 bg-card border-border/50 rounded-2xl shadow-2xl overflow-hidden"
        side="top"
        align="end"
        sideOffset={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <GifPickerContent {...contentProps} />
      </PopoverContent>
    </Popover>
  );
};
