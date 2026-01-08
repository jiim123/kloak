import { useState, useMemo, useCallback } from 'react';
import { Search, X, Smile, Image as ImageIcon, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface EmojiGifPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
  onGifSelect?: (gifUrl: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  disableGif?: boolean;
}

interface GifData {
  id: string;
  title: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

// Emoji data organized by category
const EMOJI_CATEGORIES = {
  recent: { name: 'Recently Used', icon: '🕐', emojis: [] as string[] },
  smileys: { 
    name: 'Smileys & Emotion', 
    icon: '😀', 
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
  },
  people: { 
    name: 'People & Body', 
    icon: '👋', 
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵']
  },
  animals: { 
    name: 'Animals & Nature', 
    icon: '🐶', 
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔']
  },
  food: { 
    name: 'Food & Drink', 
    icon: '🍎', 
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '🫖', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
  },
  activities: { 
    name: 'Activities', 
    icon: '⚽', 
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩']
  },
  symbols: { 
    name: 'Symbols', 
    icon: '❤️', 
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '⚧️', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '🔚', '🔙', '🔛', '🔝', '🔜', '〰️', '➰', '➿', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄']
  },
};

// Get recent emojis from localStorage
const getRecentEmojis = (): string[] => {
  try {
    const stored = localStorage.getItem('nomo-recent-emojis');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save recent emoji
const saveRecentEmoji = (emoji: string) => {
  try {
    const recent = getRecentEmojis();
    const updated = [emoji, ...recent.filter(e => e !== emoji)].slice(0, 24);
    localStorage.setItem('nomo-recent-emojis', JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
};

export const EmojiGifPicker = ({ 
  children, 
  onEmojiSelect, 
  onGifSelect,
  open, 
  onOpenChange,
  disableGif = false
}: EmojiGifPickerProps) => {
  const [activeTab, setActiveTab] = useState<'emoji' | 'gif'>('emoji');
  const [emojiSearch, setEmojiSearch] = useState('');
  const [gifSearch, setGifSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [gifs, setGifs] = useState<GifData[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const [hasSearchedGifs, setHasSearchedGifs] = useState(false);

  const recentEmojis = useMemo(() => getRecentEmojis(), [open]);

  const filteredEmojis = useMemo(() => {
    if (!emojiSearch.trim()) return null;
    
    const results: string[] = [];
    Object.values(EMOJI_CATEGORIES).forEach(category => {
      if (category.emojis) {
        results.push(...category.emojis.slice(0, 16));
      }
    });
    
    return results.slice(0, 48);
  }, [emojiSearch]);

  const handleEmojiSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    onEmojiSelect(emoji);
    onOpenChange?.(false);
  };

  const handleGifSelect = (gif: GifData) => {
    if (onGifSelect) {
      onGifSelect(gif.url);
    }
    onOpenChange?.(false);
  };

  const searchGifs = useCallback(async (query?: string) => {
    setIsLoadingGifs(true);
    setHasSearchedGifs(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('giphy-search', {
        body: { query: query?.trim() || '', limit: 24 }
      });

      if (error) throw error;
      setGifs(data.gifs || []);
    } catch (error) {
      console.error('Failed to fetch GIFs:', error);
      setGifs([]);
    } finally {
      setIsLoadingGifs(false);
    }
  }, []);

  // Load trending GIFs when switching to GIF tab
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'emoji' | 'gif');
    if (tab === 'gif' && !hasSearchedGifs) {
      searchGifs();
    }
  };

  const handleGifSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchGifs(gifSearch);
    }
  };

  const categories = Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => ({
    key,
    ...cat,
    emojis: key === 'recent' ? recentEmojis : cat.emojis,
  }));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        side="top" 
        align="end"
        sideOffset={8}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Main Tabs: Emoji vs GIF */}
        <Tabs value={disableGif ? 'emoji' : activeTab} onValueChange={handleTabChange} className="w-full">
          {!disableGif && (
            <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10">
              <TabsTrigger 
                value="emoji" 
                className="flex-1 gap-1.5 data-[state=active]:bg-accent rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <Smile className="w-4 h-4" />
                Emoji
              </TabsTrigger>
              <TabsTrigger 
                value="gif" 
                className="flex-1 gap-1.5 data-[state=active]:bg-accent rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              >
                <ImageIcon className="w-4 h-4" />
                GIF
              </TabsTrigger>
            </TabsList>
          )}

          {/* Emoji Tab Content */}
          <TabsContent value="emoji" className="m-0">
            {/* Emoji Search */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search emoji..."
                  className="pl-8 h-8"
                />
                {emojiSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6"
                    onClick={() => setEmojiSearch('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Category Tabs */}
            {!emojiSearch && (
              <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
                {categories.map(cat => (
                  <Button
                    key={cat.key}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "flex-shrink-0 px-3 py-2 rounded-none border-b-2 border-transparent font-emoji",
                      activeCategory === cat.key && "border-primary bg-accent"
                    )}
                    onClick={() => setActiveCategory(cat.key)}
                    title={cat.name}
                  >
                    <span className="text-lg font-emoji">{cat.icon}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Emoji Grid */}
            <ScrollArea className="h-64">
              <div className="p-2">
                {emojiSearch ? (
                  filteredEmojis && filteredEmojis.length > 0 ? (
                    <div className="grid grid-cols-8 gap-1">
                      {filteredEmojis.map((emoji, i) => (
                        <button
                          key={`${emoji}-${i}`}
                          type="button"
                          className="w-8 h-8 p-0 text-xl hover:bg-accent rounded-md flex items-center justify-center font-emoji transition-colors"
                          onClick={() => handleEmojiSelect(emoji)}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No emoji found
                    </p>
                  )
                ) : (
                  categories.map(cat => (
                    cat.key === activeCategory && (
                      <div key={cat.key}>
                        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">
                          {cat.name}
                        </h3>
                        {cat.emojis.length > 0 ? (
                          <div className="grid grid-cols-8 gap-1">
                            {cat.emojis.map((emoji, i) => (
                              <button
                                key={`${emoji}-${i}`}
                                type="button"
                                className="w-8 h-8 p-0 text-xl hover:bg-accent rounded-md flex items-center justify-center font-emoji transition-colors"
                                onClick={() => handleEmojiSelect(emoji)}
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            {cat.key === 'recent' ? 'No recently used emoji' : 'No emojis available'}
                          </p>
                        )}
                      </div>
                    )
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* GIF Tab Content */}
          <TabsContent value="gif" className="m-0">
            {/* GIF Search */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={gifSearch}
                  onChange={(e) => setGifSearch(e.target.value)}
                  onKeyDown={handleGifSearchKeyDown}
                  placeholder="Search GIPHY..."
                  className="pl-8 h-8"
                />
                {gifSearch && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6"
                    onClick={() => {
                      setGifSearch('');
                      searchGifs();
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* GIF Grid */}
            <ScrollArea className="h-72">
              <div className="p-2">
                {isLoadingGifs ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : gifs.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {gifs.map((gif) => (
                      <button
                        key={gif.id}
                        type="button"
                        className="relative overflow-hidden rounded-md hover:ring-2 ring-primary transition-all focus:outline-none focus:ring-2"
                        onClick={() => handleGifSelect(gif)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        <img
                          src={gif.preview}
                          alt={gif.title}
                          className="w-full h-24 object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ) : hasSearchedGifs ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No GIFs found
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Search for GIFs or view trending
                  </p>
                )}
              </div>
            </ScrollArea>

            {/* GIPHY Attribution */}
            <div className="p-2 border-t border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Powered by GIPHY</span>
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};
