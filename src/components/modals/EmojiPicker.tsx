import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Apple,
  Car,
  Cat,
  Clock,
  Flag,
  Heart,
  Lightbulb,
  Search,
  Smile,
  Trophy,
  X,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { EMOJI_DATA } from "@/data/emojiData";
import { getCdnUrl } from "@/lib/bunny-upload";
import { getGlobalEmojiDuplicates } from "@/lib/globalEmojiResolver";
import { getRecentEmojis, saveRecentEmoji } from "@/lib/emojiRecents";
import { fetchServerEmojis, ServerEmoji } from "@/lib/serverEmojis";
import { getServerInitials } from "@/lib/serverUtils";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useServerStore } from "@/stores/serverStore";

interface EmojiPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  serverId?: string;
  customEmojiFormat?: "legacy" | "inline_token";
  allowExternalEmojis?: boolean;
}

type PreviewEmoji = {
  label: string;
  native?: string;
  url?: string;
};

type LegacyCustomEmojiToken = {
  name: string;
  serverName?: string;
};

const INLINE_CUSTOM_EMOJI_TOKEN_REGEX = /^:ce\[([a-z0-9_]{2,12})\|([a-z0-9/_.-]{1,300})\]:$/;
const LEGACY_CUSTOM_EMOJI_TOKEN_REGEX = /^:([a-z0-9_]{2,12})(?:~([^:]{1,64}))?:$/;
const NATIVE_EMOJI_SET = new Set(
  Object.values(EMOJI_DATA).flatMap((category) => category.emojis.map((entry) => entry.emoji)),
);

function parseLegacyCustomEmojiToken(token: string): LegacyCustomEmojiToken | null {
  const match = token.match(LEGACY_CUSTOM_EMOJI_TOKEN_REGEX);
  if (!match) return null;
  return { name: match[1], serverName: match[2] };
}

function getStoredEmojiPreview(emoji: string): PreviewEmoji {
  const inlineMatch = emoji.match(INLINE_CUSTOM_EMOJI_TOKEN_REGEX);
  if (inlineMatch) {
    return { label: `:${inlineMatch[1]}:`, url: getCdnUrl("server-emojis", inlineMatch[2]) };
  }

  const legacyMatch = parseLegacyCustomEmojiToken(emoji);
  if (legacyMatch) {
    return { label: `:${legacyMatch.name}:` };
  }

  return { label: emoji, native: emoji };
}

const CATEGORY_ICON_MAP = {
  recent: Clock,
  smileys: Smile,
  people: Smile,
  animals: Cat,
  food: Apple,
  activities: Trophy,
  travel: Car,
  objects: Lightbulb,
  symbols: Heart,
  flags: Flag,
} as const;

export const EmojiPicker = ({
  children,
  onEmojiSelect,
  open,
  onOpenChange,
  serverId,
  customEmojiFormat = "legacy",
  allowExternalEmojis = true,
}: EmojiPickerProps) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("recent");
  const [selectedServerForEmoji, setSelectedServerForEmoji] = useState<string | null>(null);
  const [serverEmojis, setServerEmojis] = useState<Record<string, ServerEmoji[]>>({});
  const [loadingServers, setLoadingServers] = useState<Set<string>>(new Set());
  const [previewEmoji, setPreviewEmoji] = useState<PreviewEmoji | null>(null);
  const loadedServersRef = useRef<Set<string>>(new Set());
  const loadingServersRef = useRef<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const isMobile = useIsMobile();
  const servers = useServerStore((state) => state.servers);

  const recentEmojis = useMemo(() => (open ? getRecentEmojis() : []), [open]);
  const selectedServer = servers.find((server) => server.id === selectedServerForEmoji);
  const currentServerEmojis = selectedServerForEmoji ? serverEmojis[selectedServerForEmoji] || [] : [];

  const categories = useMemo(
    () =>
      Object.entries(EMOJI_DATA).map(([key, cat]) => ({
        key,
        name: cat.name,
        icon: cat.icon,
        emojis: key === "recent" ? recentEmojis : cat.emojis.map((emoji) => emoji.emoji),
      })),
    [recentEmojis],
  );

  const loadServerEmojis = useCallback(async (sId: string, opts?: { force?: boolean }) => {
    const force = opts?.force ?? false;
    if (!force && loadedServersRef.current.has(sId)) return;
    if (loadingServersRef.current.has(sId)) return;

    loadingServersRef.current.add(sId);
    setLoadingServers((prev) => new Set([...prev, sId]));
    try {
      const emojis = await fetchServerEmojis(sId, { force });
      loadedServersRef.current.add(sId);
      setServerEmojis((prev) => ({ ...prev, [sId]: emojis }));
    } catch (error) {
      console.error("Failed to fetch server emojis:", error);
      setServerEmojis((prev) => ({ ...prev, [sId]: [] }));
    } finally {
      loadingServersRef.current.delete(sId);
      setLoadingServers((prev) => {
        const next = new Set(prev);
        next.delete(sId);
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { serverId?: string } | undefined;
      const changedServerId = detail?.serverId;
      if (!changedServerId) return;
      if (!serverEmojis[changedServerId] && selectedServerForEmoji !== changedServerId) return;
      loadServerEmojis(changedServerId, { force: true });
    };

    window.addEventListener("server-emojis-changed", handler);
    return () => window.removeEventListener("server-emojis-changed", handler);
  }, [loadServerEmojis, open, selectedServerForEmoji, serverEmojis]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const recent = getRecentEmojis();
    setActiveCategory(recent.length > 0 ? "recent" : "smileys");
    setSelectedServerForEmoji(serverId || null);
    const previewRecent = recent.find((emoji) => INLINE_CUSTOM_EMOJI_TOKEN_REGEX.test(emoji) || NATIVE_EMOJI_SET.has(emoji));
    setPreviewEmoji(previewRecent ? getStoredEmojiPreview(previewRecent) : null);
  }, [open, serverId]);

  useEffect(() => {
    if (open && selectedServerForEmoji) {
      loadServerEmojis(selectedServerForEmoji);
    }
  }, [loadServerEmojis, open, selectedServerForEmoji]);

  const handleSelect = useCallback(
    (emoji: string) => {
      saveRecentEmoji(emoji);
      onEmojiSelect(emoji);
      onOpenChange?.(false);
    },
    [onEmojiSelect, onOpenChange],
  );

  const handleCustomEmojiSelect = useCallback(
    (emoji: ServerEmoji) => {
      if (customEmojiFormat === "inline_token") {
        const token = `:ce[${emoji.name}|${emoji.file_path}]:`;
        saveRecentEmoji(token);
        onEmojiSelect(token);
        onOpenChange?.(false);
        return;
      }

      const duplicates = getGlobalEmojiDuplicates();
      const server = selectedServerForEmoji ? servers.find((s) => s.id === selectedServerForEmoji) : null;
      const customEmojiString =
        duplicates.has(emoji.name) && server ? `:${emoji.name}~${server.name}:` : `:${emoji.name}:`;

      saveRecentEmoji(customEmojiString);
      onEmojiSelect(customEmojiString);
      onOpenChange?.(false);
    },
    [customEmojiFormat, onEmojiSelect, onOpenChange, selectedServerForEmoji, servers],
  );

  const filteredEmojis = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    if (!trimmedSearch) return null;

    const results: Array<{ type: "native"; emoji: string } | { type: "custom"; emoji: ServerEmoji }> = [];

    Object.values(EMOJI_DATA).forEach((category) => {
      category.emojis.forEach((emojiData) => {
        if (emojiData.keywords.some((keyword) => keyword.includes(trimmedSearch))) {
          results.push({ type: "native", emoji: emojiData.emoji });
        }
      });
    });

    Object.values(serverEmojis).forEach((emojis) => {
      emojis.forEach((emoji) => {
        if (
          emoji.name.toLowerCase().includes(trimmedSearch) &&
          !results.some((result) => result.type === "custom" && result.emoji.id === emoji.id)
        ) {
          results.push({ type: "custom", emoji });
        }
      });
    });

    return results.slice(0, 72);
  }, [search, serverEmojis]);

  const renderEmojiButton = (
    key: string,
    emoji: string,
    options?: {
      label?: string;
      url?: string;
      disabled?: boolean;
      onClick?: () => void;
      className?: string;
      textFallback?: string;
    },
  ) => {
    const label = options?.label || emoji;

    return (
      <button
        key={key}
        type="button"
        className={cn(
          "flex h-11 w-11 sm:h-[28px] sm:w-[28px] shrink-0 items-center justify-center rounded-md sm:rounded-[4px] transition-colors duration-100",
          "hover:bg-[#3b3f45] focus:bg-[#3b3f45] focus:outline-none active:bg-[#454950]",
          options?.disabled && "pointer-events-none opacity-40",
          options?.className,
        )}
        onClick={options?.onClick ?? (() => handleSelect(emoji))}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => {
          if (options?.url) {
            setPreviewEmoji({ label, url: options.url });
          } else if (options?.textFallback) {
            setPreviewEmoji({ label });
          } else {
            setPreviewEmoji({ label, native: emoji });
          }
        }}
        title={label}
      >
        {options?.url ? (
          <img src={options.url} alt={label} className="h-7 w-7 sm:h-[22px] sm:w-[22px] object-contain" loading="lazy" />
        ) : options?.textFallback ? (
          <span className="block max-w-full truncate text-[11px] sm:text-[9px] leading-none text-[#b9bbbe]">{options.textFallback}</span>
        ) : (
          <FluentEmoji emoji={emoji} size={isMobile ? 28 : 22} />
        )}
      </button>
    );
  };


  const renderServerEmojiGrid = () => {
    if (!selectedServerForEmoji || !selectedServer) return null;

    const isExternalServer = selectedServerForEmoji !== serverId;
    const isDisabledSection = isExternalServer && !allowExternalEmojis;

    return (
      <div>
        <div className="mb-1.5 px-0.5 text-[10px] font-semibold leading-none text-[#b9bbbe]">
          {selectedServer.name}
          {isDisabledSection && <span className="ml-1 text-[#8e9297]">- External disabled</span>}
        </div>
        {loadingServers.has(selectedServerForEmoji) ? (
          <div className="flex h-[120px] items-center justify-center text-center">
            <p className="text-[11px] text-[#8e9297]">Loading emojis...</p>
          </div>
        ) : currentServerEmojis.length > 0 ? (
          <div className={cn("grid grid-cols-9 gap-[1px]", isDisabledSection && "pointer-events-none opacity-50")}>
            {currentServerEmojis.map((emoji) =>
              renderEmojiButton(`server-${emoji.id}`, `:${emoji.name}:`, {
                label: `:${emoji.name}:`,
                url: emoji.url,
                onClick: () => handleCustomEmojiSelect(emoji),
              }),
            )}
          </div>
        ) : (
          <div className="flex h-[120px] items-center justify-center text-center">
            <p className="text-[11px] font-medium text-[#8e9297]">No custom emojis</p>
          </div>
        )}
      </div>
    );
  };

  const renderNativeCategory = () =>
    categories.map((cat) => {
      if (cat.key !== activeCategory) return null;

      return (
        <div key={cat.key}>
          <div className="mb-1.5 px-0.5 text-[10px] font-semibold leading-none text-[#b9bbbe]">
            {cat.key === "recent" ? "Frequently used" : cat.name}
          </div>

          {cat.emojis.length > 0 ? (
            <div className="grid grid-cols-9 gap-[1px]">
              {cat.emojis
                .map((emoji, index) => renderRecentOrNativeEmoji(cat.key, emoji, index))
                .filter(Boolean)}
            </div>
          ) : (
            <div className="flex h-[34px] items-center">
              <p className="px-0.5 text-[11px] font-medium text-[#8e9297]">No recently used emoji</p>
            </div>
          )}

          {cat.key === "recent" && selectedServer && (
            <div className="mt-2">
              <div className="mb-1.5 px-0.5 text-[10px] font-semibold leading-none text-[#b9bbbe]">
                {selectedServer.name}
              </div>
              {loadingServers.has(selectedServer.id) ? (
                <p className="px-0.5 text-[11px] text-[#8e9297]">Loading emojis...</p>
              ) : currentServerEmojis.length > 0 ? (
                <div className="grid grid-cols-9 gap-[1px]">
                  {currentServerEmojis.slice(0, 54).map((emoji) =>
                    renderEmojiButton(`server-inline-${emoji.id}`, `:${emoji.name}:`, {
                      label: `:${emoji.name}:`,
                      url: emoji.url,
                      onClick: () => handleCustomEmojiSelect(emoji),
                    }),
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      );
    });

  const renderRecentOrNativeEmoji = (categoryKey: string, emoji: string, index: number) => {
    const key = `${categoryKey}-${emoji}-${index}`;
    const isCustomEmoji = categoryKey === "recent" && emoji.startsWith(":") && emoji.endsWith(":") && emoji.length > 2;

    if (!isCustomEmoji) {
      if (categoryKey === "recent" && !NATIVE_EMOJI_SET.has(emoji)) return null;
      return renderEmojiButton(key, emoji);
    }

    const inlineMatch = emoji.match(INLINE_CUSTOM_EMOJI_TOKEN_REGEX);
    if (inlineMatch) {
      const url = getCdnUrl("server-emojis", inlineMatch[2]);
      return renderEmojiButton(key, emoji, {
        label: `:${inlineMatch[1]}:`,
        url,
        onClick: () => handleSelect(emoji),
      });
    }

    const legacyMatch = parseLegacyCustomEmojiToken(emoji);
    const emojiName = legacyMatch?.name ?? emoji.slice(1, -1);
    const customEmoji = Object.values(serverEmojis)
      .flat()
      .find((item) => {
        if (item.name !== emojiName) return false;
        if (!legacyMatch?.serverName) return true;
        const server = servers.find((candidate) =>
          serverEmojis[candidate.id]?.some((serverEmoji) => serverEmoji.id === item.id),
        );
        return server?.name === legacyMatch.serverName;
      });

    if (customEmoji) {
      return renderEmojiButton(key, emoji, {
        label: emoji,
        url: customEmoji.url,
        onClick: () => handleCustomEmojiSelect(customEmoji),
      });
    }

    return null;
  };

  const pickerContent = (
    <div className="flex h-full min-h-0 flex-col bg-[#282b30] text-[#dcddde]">
      {!search.trim() && (
        <div className="border-b border-[#202225] bg-[#24272c] px-1.5 py-1">
          <div ref={categoryScrollRef} className="flex h-[29px] items-center gap-[3px] overflow-x-auto scrollbar-hide">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICON_MAP[cat.key as keyof typeof CATEGORY_ICON_MAP] || Smile;
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  className={cn(
                    "flex h-[23px] w-[24px] shrink-0 items-center justify-center rounded-[3px] text-[#8e9297] transition-colors",
                    isActive && activeCategory !== "server"
                      ? "bg-[#36393f] text-[#f2f3f5]"
                      : "hover:bg-[#303339] hover:text-[#dcddde]",
                  )}
                  onClick={() => {
                    setActiveCategory(cat.key);
                    setSelectedServerForEmoji(serverId || null);
                  }}
                  title={cat.name}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
              );
            })}
          </div>
          {servers.length > 0 && (
            <div className="mt-1 flex h-[30px] items-center gap-[4px] overflow-x-auto scrollbar-hide">
              {servers.map((server) => {
                const isExternal = server.id !== serverId;
                const isDisabled = isExternal && !allowExternalEmojis;
                const isActive = activeCategory === "server" && selectedServerForEmoji === server.id;

                return (
                  <button
                    key={server.id}
                    type="button"
                    className={cn(
                      "flex h-[28px] w-[28px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] border border-transparent bg-[#36393f] text-[9px] font-semibold text-[#dcddde] transition-colors",
                      "hover:border-[#555b64] hover:bg-[#3b3f45]",
                      isActive && "border-[#8e9297] bg-[#42464d]",
                      isDisabled && "cursor-not-allowed opacity-35 hover:border-transparent",
                    )}
                    onClick={() => {
                      if (isDisabled) return;
                      setSelectedServerForEmoji(server.id);
                      setActiveCategory("server");
                      loadServerEmojis(server.id);
                    }}
                    title={isDisabled ? `${server.name} - external emojis disabled` : server.name}
                  >
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      getServerInitials(server.name)
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="px-2 pb-1.5 pt-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[14px] w-[14px] -translate-y-1/2 text-[#7b8088]" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search"
            className="h-[28px] w-full rounded-full border border-[#22252a] bg-[#25282d] pl-8 pr-8 text-[11px] leading-none text-[#dcddde] outline-none placeholder:text-[#8e9297] focus:border-[#343940] focus:bg-[#24272c]"
          />
          {search && (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full text-[#8e9297] hover:text-[#dcddde]"
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
            >
              <X className="h-[14px] w-[14px]" />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className={isMobile ? "min-h-0 flex-1 overflow-y-auto" : "h-[224px]"}>
        <div className="px-2 pb-1 pt-0.5">
          {search.trim() ? (
            filteredEmojis && filteredEmojis.length > 0 ? (
              <>
                <div className="mb-1.5 px-0.5 text-[10px] font-semibold leading-none text-[#b9bbbe]">
                  Results for "{search.trim()}"
                </div>
                <div className="grid grid-cols-9 gap-[1px]">
                  {filteredEmojis.map((item, index) => {
                    if (item.type === "native") {
                      return renderEmojiButton(`search-native-${item.emoji}-${index}`, item.emoji);
                    }

                    const isExternal =
                      !allowExternalEmojis && serverId && !serverEmojis[serverId]?.some((emoji) => emoji.id === item.emoji.id);
                    return renderEmojiButton(`search-custom-${item.emoji.id}`, `:${item.emoji.name}:`, {
                      label: isExternal ? "External emojis disabled" : `:${item.emoji.name}:`,
                      url: item.emoji.url,
                      disabled: !!isExternal,
                      onClick: () => handleCustomEmojiSelect(item.emoji),
                    });
                  })}
                </div>
              </>
            ) : (
              <div className="flex h-[120px] items-center justify-center text-center">
                <p className="text-[11px] font-medium text-[#8e9297]">No emoji found</p>
              </div>
            )
          ) : activeCategory === "server" ? (
            renderServerEmojiGrid()
          ) : (
            renderNativeCategory()
          )}
        </div>
      </ScrollArea>

      <div className="flex h-[36px] shrink-0 items-center justify-between border-t border-[#202225] bg-[#333743] px-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[4px]">
            {previewEmoji?.url ? (
              <img src={previewEmoji.url} alt={previewEmoji.label} className="h-[26px] w-[26px] object-contain" />
            ) : previewEmoji?.native ? (
              <FluentEmoji emoji={previewEmoji.native} size={24} />
            ) : (
              <Smile className="h-4 w-4 text-[#b9bbbe]" />
            )}
          </div>
          <span className="truncate text-[11px] font-medium text-[#b9bbbe]">
            {previewEmoji?.label?.replace(/^:/, "").replace(/:$/, "") || "Select an emoji"}
          </span>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{children}</DrawerTrigger>
        <DrawerContent className="flex h-[70vh] max-h-[90vh] flex-col overflow-hidden rounded-t-[4px] border-0 bg-[#282b30] p-0">
          {pickerContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[304px] overflow-hidden rounded-[4px] border-0 bg-[#282b30] p-0 shadow-[0_8px_22px_rgba(0,0,0,0.35)]"
        side="top"
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {pickerContent}
      </PopoverContent>
    </Popover>
  );
};
