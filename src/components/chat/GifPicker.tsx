import { useState, useEffect, useCallback, useRef } from "react";
import poweredByKlipy from "@/assets/powered-by-klipy.svg";
import { Search, X, Clock, TrendingUp, LayoutGrid } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  children?: React.ReactNode;
  anchor?: React.ReactNode;
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
            <Skeleton key={i} className="aspect-square rounded-[4px]" />
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
              className="aspect-square overflow-hidden rounded-[4px] transition-all hover:ring-2 hover:ring-[#8e9297]/60 focus:outline-none focus:ring-2 focus:ring-[#8e9297]/60"
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
      <div className="border-b border-[#202225] bg-[#24272c] px-1.5 py-1">
        <div className="flex h-[29px] items-center gap-[3px]">
        {([
          { key: "trending" as Tab, icon: TrendingUp, label: "Trending" },
          { key: "categories" as Tab, icon: LayoutGrid, label: "Categories" },
          { key: "recent" as Tab, icon: Clock, label: "Recent" },
        ]).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            className={cn(
              "flex h-[23px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[3px] px-2 text-[11px] font-medium transition-colors",
              tab === key
                ? "bg-[#36393f] text-[#f2f3f5]"
                : "text-[#8e9297] hover:bg-[#303339] hover:text-[#dcddde]",
            )}
            onClick={() => {
              setTab(key);
              if (key === "categories") setSelectedCategory(null);
            }}
          >
            <Icon className="h-[14px] w-[14px]" />
            {label}
          </button>
        ))}
        </div>
      </div>

      {/* Search bar (trending tab only) */}
      {tab === "trending" && (
        <div className="px-2 pb-1.5 pt-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[#7b8088]" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search GIFs..."
              className="h-[28px] w-full rounded-full border border-[#22252a] bg-[#25282d] pl-8 pr-8 text-[11px] leading-none text-[#dcddde] outline-none placeholder:text-[#8e9297] focus:border-[#343940] focus:bg-[#24272c]"
            />
            {query && (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full text-[#8e9297] hover:text-[#dcddde]"
                onClick={() => handleSearchChange("")}
              >
                <X className="h-[14px] w-[14px]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className={isMobile ? "min-h-0 flex-1 overflow-y-auto" : "h-[320px]"}>
        <div className="px-2 pb-1 pt-0.5">
          {tab === "trending" && renderGifGrid(
            gifs, loading,
            <Search className="w-8 h-8 text-muted-foreground/30 mb-3" />,
            "No GIFs found",
            "Try a different search term",
          )}

          {tab === "categories" && !selectedCategory && (
            categoriesLoading ? (
              <div className="grid grid-cols-2 gap-1.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-[4px]" />
                ))}
              </div>
            ) : categories.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map((cat) => (
                  <button
                    key={cat.query}
                    type="button"
                    className="group relative h-20 overflow-hidden rounded-[4px] focus:outline-none focus:ring-2 focus:ring-[#8e9297]/60"
                    onClick={() => handleCategoryClick(cat.query)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <img
                      src={cat.preview_url}
                      alt={cat.category}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/50">
                      <span className="text-sm font-semibold capitalize text-white drop-shadow-md">
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
                className="mb-2 flex items-center gap-1.5 text-[11px] text-[#8e9297] transition-colors hover:text-[#dcddde]"
                onClick={handleBackToCategories}
              >
                <X className="h-[14px] w-[14px]" />
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
      <div className="flex h-[36px] items-center justify-center border-t border-[#202225] bg-[#333743] px-2">
        <a
          href="https://klipy.com"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-60 transition-opacity hover:opacity-80"
        >
          <img src={poweredByKlipy} alt="Powered by KLIPY" className="h-4" />
        </a>
      </div>
    </>
  );
}

export const GifPicker = ({ children, anchor, onSelect, open, onOpenChange }: GifPickerProps) => {
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
  const ignoreOutsideCloseRef = useRef(false);
  const safeOpenChange = useCallback(
    (nextOpen: boolean) => {
      // When opened from another floating UI (e.g. plus-menu), suppress immediate
      // close signals fired during the handoff animation/focus transfer.
      if (!nextOpen && ignoreOutsideCloseRef.current) return;
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

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
    if (open) {
      ignoreOutsideCloseRef.current = true;
      const timer = window.setTimeout(() => {
        ignoreOutsideCloseRef.current = false;
      }, 120);

      return () => window.clearTimeout(timer);
    }

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
      <Drawer open={open} onOpenChange={safeOpenChange}>
        {children && <DrawerTrigger asChild>{children}</DrawerTrigger>}
        <DrawerContent className="flex h-[70vh] max-h-[90vh] flex-col overflow-hidden rounded-t-[4px] border-0 bg-[#282b30] p-0">
          <GifPickerContent {...contentProps} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={safeOpenChange}>
      {anchor ? <PopoverAnchor asChild>{anchor}</PopoverAnchor> : children && <PopoverTrigger asChild>{children}</PopoverTrigger>}
      <PopoverContent
        className="w-[304px] overflow-hidden rounded-[4px] border-0 bg-[#282b30] p-0 shadow-[0_8px_22px_rgba(0,0,0,0.35)]"
        side="top"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (ignoreOutsideCloseRef.current) {
            e.preventDefault();
          }
        }}
      >
        <GifPickerContent {...contentProps} />
      </PopoverContent>
    </Popover>
  );
};
