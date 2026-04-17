import { CaretLeft, CaretRight, Clock, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getServerInitials, getServerColor } from "@/lib/serverUtils";
import { useServerStore } from "@/stores/serverStore";
import { fetchServerEmojis, ServerEmoji } from "@/lib/serverEmojis";
import { getGlobalEmojiDuplicates } from "@/lib/globalEmojiResolver";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { EMOJI_DATA, EmojiCategory } from "@/data/emojiData";
import { getRecentEmojis, saveRecentEmoji } from "@/lib/emojiRecents";
import { getCdnUrl } from "@/lib/bunny-upload";
import { useIsMobile } from "@/hooks/use-mobile";

interface EmojiPickerProps {
 children: React.ReactNode;
 onEmojiSelect: (emoji: string) => void;
 open?: boolean;
 onOpenChange?: (open: boolean) => void;
 serverId?: string;
 customEmojiFormat?: "legacy" | "inline_token";
 allowExternalEmojis?: boolean;
}

const INLINE_CUSTOM_EMOJI_TOKEN_REGEX = /^:ce\[([a-z0-9_]{2,12})\|([a-z0-9/_\.-]{1,300})\]:$/;

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
 const loadedServersRef = useRef<Set<string>>(new Set());
 const loadingServersRef = useRef<Set<string>>(new Set());
 const searchInputRef = useRef<HTMLInputElement>(null);
 const categoryScrollRef = useRef<HTMLDivElement>(null);
 const serverScrollRef = useRef<HTMLDivElement>(null);
 const [canScrollLeft, setCanScrollLeft] = useState(false);
 const [canScrollRight, setCanScrollRight] = useState(false);

 const servers = useServerStore((state) => state.servers);

 // Refresh recent emojis when picker opens
 const recentEmojis = useMemo(() => {
 if (open) {
 return getRecentEmojis();
 }
 return [];
 }, [open]);

 // Fetch server emojis when a server is selected
 const loadServerEmojis = useCallback(
 async (sId: string, opts?: { force?: boolean }) => {
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
 },
 [],
 );

 // When emojis change elsewhere (upload/rename/delete), refresh any loaded lists.
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
 }, [open, serverEmojis, selectedServerForEmoji, loadServerEmojis]);

 // Load current server emojis when picker opens
 useEffect(() => {
 if (open) {
 setSelectedServerForEmoji(serverId);
 }
 }, [open, serverId]);

 // Load emojis when selecting a different server
 useEffect(() => {
 if (open && selectedServerForEmoji) {
 loadServerEmojis(selectedServerForEmoji);
 }
 }, [open, selectedServerForEmoji, loadServerEmojis]);

 // Check scroll state for category bar
 const updateScrollState = useCallback(() => {
 const container = categoryScrollRef.current;
 if (container) {
 const { scrollLeft, scrollWidth, clientWidth } = container;
 setCanScrollLeft(scrollLeft > 2);
 setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
 }
 }, []);

 // Scroll category bar
 const scrollCategories = useCallback((direction: "left" | "right") => {
 const container = categoryScrollRef.current;
 if (container) {
 const scrollAmount = 120;
 container.scrollBy({
 left: direction === "left" ? -scrollAmount : scrollAmount,
 behavior: "smooth",
 });
 }
 }, []);

 // Handle emoji selection
 const handleSelect = useCallback(
 (emoji: string) => {
 saveRecentEmoji(emoji);
 onEmojiSelect(emoji);
 onOpenChange?.(false);
 },
 [onEmojiSelect, onOpenChange],
 );

 // Handle custom emoji selection — qualify with server name when duplicate
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
 const isDuplicate = duplicates.has(emoji.name);

 // If duplicate, find which server this emoji belongs to and qualify it
 let customEmojiString = `:${emoji.name}:`;
 if (isDuplicate && selectedServerForEmoji) {
 const server = servers.find((s) => s.id === selectedServerForEmoji);
 if (server) {
 customEmojiString = `:${emoji.name}~${server.name}:`;
 }
 }

 saveRecentEmoji(customEmojiString);
 onEmojiSelect(customEmojiString);
 onOpenChange?.(false);
 },
 [customEmojiFormat, onEmojiSelect, onOpenChange, selectedServerForEmoji, servers],
 );

 // Reset search and set category when picker opens/closes
 useEffect(() => {
 if (!open) {
 setSearch("");
 return;
 }

 // When opening, show recent if available, otherwise smileys
 const recent = getRecentEmojis();
 setActiveCategory(recent.length > 0 ? "recent" : "smileys");

 // Check scroll state after render
 const frameId = requestAnimationFrame(() => {
 updateScrollState();
 });

 return () => {
 cancelAnimationFrame(frameId);
 };
 }, [open, updateScrollState]);

 // Update scroll state on resize
 useEffect(() => {
 if (!open) return;

 const container = categoryScrollRef.current;
 if (!container) return;

 const resizeObserver = new ResizeObserver(() => {
 updateScrollState();
 });

 resizeObserver.observe(container);

 return () => {
 resizeObserver.disconnect();
 };
 }, [open, updateScrollState]);

 // Get current server's custom emojis
 const currentServerEmojis = selectedServerForEmoji ? serverEmojis[selectedServerForEmoji] || [] : [];

 // Filter emojis based on search
 const filteredEmojis = useMemo(() => {
 const trimmedSearch = search.trim().toLowerCase();
 if (!trimmedSearch) return null;

 const results: Array<{ type: "native"; emoji: string } | { type: "custom"; emoji: ServerEmoji }> = [];

 // MagnifyingGlass through all native categories
 Object.values(EMOJI_DATA).forEach((category) => {
 if (category.emojis) {
 category.emojis.forEach((emojiData) => {
 if (emojiData.keywords.some((keyword) => keyword.includes(trimmedSearch))) {
 results.push({ type: "native", emoji: emojiData.emoji });
 }
 });
 }
 });

 // MagnifyingGlass through custom emojis from all loaded servers
 Object.values(serverEmojis).forEach((emojis) => {
 emojis.forEach((emoji) => {
 if (emoji.name.toLowerCase().includes(trimmedSearch)) {
 // Avoid duplicates
 if (!results.some((r) => r.type === "custom" && (r.emoji as ServerEmoji).id === emoji.id)) {
 results.push({ type: "custom", emoji });
 }
 }
 });
 });

 return results.slice(0, 50);
 }, [search, serverEmojis]);

 // Build categories with recent emojis
 const categories = useMemo(() => {
 return Object.entries(EMOJI_DATA).map(([key, cat]) => ({
 key,
 name: cat.name,
 icon: cat.icon,
 emojis: key === "recent" ? recentEmojis : cat.emojis.map((e) => e.emoji),
 }));
 }, [recentEmojis]);

 const isMobile = useIsMobile();

 const pickerContent = (
 <>
 {/* MagnifyingGlass Header */}
 <div className="p-3 border-b border-border/30">
 <div className="relative">
 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
 <input
 ref={searchInputRef}
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="MagnifyingGlass emoji..."
 className="w-full h-11 pl-10 pr-10 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30 focus:bg-muted/40 transition-all"
 />
 {search && (
 <button
 type="button"
 className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
 onClick={() => {
 setSearch("");
 searchInputRef.current?.focus();
 }}
 >
 <X className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Category Tabs - Scrollable */}
 {!search.trim() && (
 <div className="relative border-b border-border/30">
 {/* Left scroll button */}
 {canScrollLeft && (
 <button
 type="button"
 onClick={() => scrollCategories("left")}
 onMouseDown={(e) => e.preventDefault()}
 className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card via-card/95 to-transparent z-10 flex items-center justify-start pl-1"
 >
 <CaretLeft className="w-4 h-4 text-muted-foreground" />
 </button>
 )}

 {/* Scrollable container */}
 <div
 ref={categoryScrollRef}
 className="flex px-2 py-2 gap-0.5 overflow-x-auto scrollbar-hide scroll-smooth"
 onScroll={updateScrollState}
 >
 {categories.map((cat) => (
 <button
 key={cat.key}
 type="button"
 className={cn(
 "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
 activeCategory === cat.key
 ? "bg-primary/10 ring-1 ring-primary/20"
 : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
 )}
 onClick={() => {
 setActiveCategory(cat.key);
 setSelectedServerForEmoji(null); // Deselect server when switching to native category
 }}
 title={cat.name}
 >
 {cat.key === "recent" ? (
 <Clock
 className={cn(
 "w-5 h-5 transition-colors",
 activeCategory === cat.key ? "text-primary" : "text-muted-foreground",
 )}
 />
 ) : (
 <FluentEmoji emoji={cat.icon} size={22} />
 )}
 </button>
 ))}
 </div>

 {/* Right scroll button */}
 {canScrollRight && (
 <button
 type="button"
 onClick={() => scrollCategories("right")}
 onMouseDown={(e) => e.preventDefault()}
 className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card via-card/95 to-transparent z-10 flex items-center justify-end pr-1"
 >
 <CaretRight className="w-4 h-4 text-muted-foreground" />
 </button>
 )}
 </div>
 )}

 {/* Emoji Grid */}
 <ScrollArea className={isMobile ? "flex-1 min-h-0 overflow-y-auto" : "h-[220px] sm:h-[280px]"}>
 <div className="p-2 sm:p-3">
 {search.trim() ? (
 // MagnifyingGlass results
 filteredEmojis && filteredEmojis.length > 0 ? (
 <>
 <div className="flex items-center gap-2 mb-2 px-1">
 <MagnifyingGlass className="w-4 h-4 text-muted-foreground" />
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
 Results for "{search.trim()}"
 </span>
 </div>
 <div className="grid grid-cols-4 gap-1">
 {filteredEmojis.map((item, i) =>
 item.type === "native" ? (
 <button
 key={`search-native-${item.emoji}-${i}`}
 type="button"
 className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
 onClick={() => handleSelect(item.emoji)}
 onMouseDown={(e) => e.preventDefault()}
 >
 <FluentEmoji emoji={item.emoji} size={36} />
 </button>
 ) : (() => {
 const isExternal = !allowExternalEmojis && serverId && !serverEmojis[serverId]?.some(e => e.id === item.emoji.id);
 return (
 <button
 key={`search-custom-${item.emoji.id}`}
 type="button"
 className={cn(
 "aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1",
 isExternal && "opacity-50 pointer-events-none",
 )}
 onClick={() => handleCustomEmojiSelect(item.emoji)}
 onMouseDown={(e) => e.preventDefault()}
 title={isExternal ? "External emojis disabled" : `:${item.emoji.name}:`}
 >
 <img
 src={item.emoji.url}
 alt={item.emoji.name}
 className="w-9 h-9 object-contain"
 />
 </button>
 );
 })(),
 )}
 </div>
 </>
 ) : (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mb-3">
 <MagnifyingGlass className="w-6 h-6 text-muted-foreground/40" />
 </div>
 <p className="text-sm font-medium text-muted-foreground">No emoji found</p>
 <p className="text-xs text-muted-foreground/60 mt-1">Try "happy", "love", or "fire"</p>
 </div>
 )
 ) : selectedServerForEmoji ? (
 // Custom server emoji view
 (() => {
 const isExternalServer = selectedServerForEmoji !== serverId;
 const isDisabledSection = isExternalServer && !allowExternalEmojis;
 return (
 <div>
 <div className="flex items-center gap-2 mb-2 px-1">
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
 {servers.find((s) => s.id === selectedServerForEmoji)?.name || "Server"} Emojis
 </span>
 {isDisabledSection && (
 <span className="text-[10px] text-muted-foreground/60 italic">
 — External emojis disabled
 </span>
 )}
 </div>
 {loadingServers.has(selectedServerForEmoji) ? (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
 <p className="text-sm text-muted-foreground">Loading emojis...</p>
 </div>
 ) : currentServerEmojis.length > 0 ? (
 <div className={cn("grid grid-cols-4 gap-1", isDisabledSection && "opacity-50 pointer-events-none")}>
 {currentServerEmojis.map((emoji) => (
 <button
 key={emoji.id}
 type="button"
 className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
 onClick={() => handleCustomEmojiSelect(emoji)}
 onMouseDown={(e) => e.preventDefault()}
 title={`:${emoji.name}:`}
 >
 <img src={emoji.url} alt={emoji.name} className="w-9 h-9 object-contain" />
 </button>
 ))}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
 <FluentEmoji emoji="😢" size={28} />
 </div>
 <p className="text-sm font-medium text-muted-foreground">No custom emojis</p>
 <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[180px]">
 This server doesn't have any custom emojis yet
 </p>
 </div>
 )}
 </div>
 );
 })()
 ) : (
 // Category view
 categories.map(
 (cat) =>
 cat.key === activeCategory && (
 <div key={cat.key}>
 {/* Category Header */}
 <div className="flex items-center gap-2 mb-2 px-1">
 {cat.key === "recent" ? (
 <Clock className="w-4 h-4 text-muted-foreground" />
 ) : (
 <FluentEmoji emoji={cat.icon} size={18} />
 )}
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
 {cat.name}
 </span>
 </div>

 {cat.emojis.length > 0 ? (
 <div className="grid grid-cols-4 gap-1">
 {cat.emojis.map((emoji, i) => {
 // Check if this is a custom emoji (format: :name:)
 const isCustomEmoji =
 cat.key === "recent" && emoji.startsWith(":") && emoji.endsWith(":") && emoji.length > 2;
 
 if (isCustomEmoji) {
 const inlineMatch = emoji.match(INLINE_CUSTOM_EMOJI_TOKEN_REGEX);
 if (inlineMatch) {
 const filePath = inlineMatch[2];
 const emojiUrl = getCdnUrl("server-emojis", filePath);
 return (
 <button
 key={`${cat.key}-${emoji}-${i}`}
 type="button"
 className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
 onClick={() => handleSelect(emoji)}
 onMouseDown={(e) => e.preventDefault()}
 title={emoji}
 >
 <img
 src={emojiUrl}
 alt={inlineMatch[1]}
 className="w-9 h-9 object-contain"
 />
 </button>
 );
 }

 // Find the custom emoji in loaded server emojis
 const emojiName = emoji.slice(1, -1);
 let customEmoji: ServerEmoji | undefined;
 
 for (const emojis of Object.values(serverEmojis)) {
 customEmoji = emojis.find((e) => e.name === emojiName);
 if (customEmoji) break;
 }
 
 if (customEmoji) {
 return (
 <button
 key={`${cat.key}-${emoji}-${i}`}
 type="button"
 className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
 onClick={() => handleCustomEmojiSelect(customEmoji!)}
 onMouseDown={(e) => e.preventDefault()}
 title={emoji}
 >
 <img
 src={customEmoji.url}
 alt={emojiName}
 className="w-9 h-9 object-contain"
 />
 </button>
 );
 }
 
 // Custom emoji not found - show placeholder
 return (
 <button
 key={`${cat.key}-${emoji}-${i}`}
 type="button"
 className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
 onClick={() => handleSelect(emoji)}
 onMouseDown={(e) => e.preventDefault()}
 title={emoji}
 >
 <span className="text-xs text-muted-foreground truncate max-w-full px-0.5">
 {emoji}
 </span>
 </button>
 );
 }
 
 // Native emoji
 return (
 <button
 key={`${cat.key}-${emoji}-${i}`}
 type="button"
 className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
 onClick={() => handleSelect(emoji)}
 onMouseDown={(e) => e.preventDefault()}
 >
 <FluentEmoji emoji={emoji} size={36} />
 </button>
 );
 })}
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center py-12 text-center">
 <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
 <Clock className="w-6 h-6 text-muted-foreground/40" />
 </div>
 <p className="text-sm font-medium text-muted-foreground">No recently used emoji</p>
 <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[180px]">
 Emoji you use will appear here
 </p>
 </div>
 )}
 </div>
 ),
 )
 )}
 </div>
 </ScrollArea>

 {/* Server Selector Bar */}
 {servers.length > 0 && !search.trim() && (
 <div className="border-t border-border/30 p-2">
 <div className="flex items-center gap-1.5 mb-1.5 px-1">
 <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
 Server Emojis
 </span>
 </div>
 <div
 ref={serverScrollRef}
 className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5"
 onWheel={(e) => {
 if (serverScrollRef.current && e.deltaY !== 0) {
 e.preventDefault();
 serverScrollRef.current.scrollLeft += e.deltaY;
 }
 }}
 >
 {servers.map((server) => {
 const isExternal = server.id !== serverId;
 const isDisabled = isExternal && !allowExternalEmojis;
 return (
 <Tooltip key={server.id}>
 <TooltipTrigger asChild>
 <button
 type="button"
 onClick={() => {
 if (isDisabled) return;
 setSelectedServerForEmoji(server.id);
 setActiveCategory(""); // Deselect native category
 }}
 className={cn(
 "flex-shrink-0 w-9 h-9 rounded-lg transition-all duration-200",
 selectedServerForEmoji === server.id
 ? "opacity-100"
 : "opacity-50 grayscale hover:opacity-70 hover:grayscale-[50%]",
 isDisabled && "!opacity-30 cursor-not-allowed pointer-events-auto",
 )}
 title={isDisabled ? undefined : server.name}
 >
 <Avatar className="w-full h-full rounded-lg">
 {server.icon_url ? (
 <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
 ) : null}
 <AvatarFallback className={cn("rounded-lg text-xs font-medium text-white", getServerColor(server.name))}>
 {getServerInitials(server.name)}
 </AvatarFallback>
 </Avatar>
 </button>
 </TooltipTrigger>
 {isDisabled && (
 <TooltipContent side="top" className="text-xs">
 External emojis are disabled in this channel
 </TooltipContent>
 )}
 </Tooltip>
 );
 })}
 </div>
 </div>
 )}
 </>
 );

 if (isMobile) {
 return (
 <Drawer open={open} onOpenChange={onOpenChange}>
 <DrawerTrigger asChild>{children}</DrawerTrigger>
 <DrawerContent className="h-[70vh] max-h-[90vh] p-0 bg-card border-border/50 rounded-t-2xl overflow-hidden flex flex-col">
 {pickerContent}
 </DrawerContent>
 </Drawer>
 );
 }

 return (
 <Popover open={open} onOpenChange={onOpenChange}>
 <PopoverTrigger asChild>{children}</PopoverTrigger>
 <PopoverContent
 className="w-[280px] sm:w-[340px] p-0 bg-card border-border/50 rounded-2xl shadow-2xl overflow-hidden"
 side="top"
 align="end"
 sideOffset={12}
 onOpenAutoFocus={(e) => e.preventDefault()}
 >
 {pickerContent}
 </PopoverContent>
 </Popover>
 );
};
