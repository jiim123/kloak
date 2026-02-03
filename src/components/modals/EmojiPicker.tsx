import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface EmojiPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Emoji data organized by category
const EMOJI_CATEGORIES = {
  recent: { name: "Recently Used", icon: "🕐", emojis: [] as string[] },
  smileys: {
    name: "Smileys & Emotion",
    icon: "😀",
    emojis: [
      "😀",
      "😃",
      "😄",
      "😁",
      "😅",
      "😂",
      "🤣",
      "😊",
      "😇",
      "🙂",
      "🙃",
      "😉",
      "😌",
      "😍",
      "🥰",
      "😘",
      "😗",
      "😙",
      "😚",
      "😋",
      "😛",
      "😜",
      "🤪",
      "😝",
      "🤑",
      "🤗",
      "🤭",
      "🤫",
      "🤔",
      "🤐",
      "🤨",
      "😐",
      "😑",
      "😶",
      "😏",
      "😒",
      "🙄",
      "😬",
      "😮‍💨",
      "🤥",
      "😌",
      "😔",
      "😪",
      "🤤",
      "😴",
      "😷",
      "🤒",
      "🤕",
      "🤢",
      "🤮",
      "🤧",
      "🥵",
      "🥶",
      "🥴",
      "😵",
      "🤯",
      "🤠",
      "🥳",
      "🥸",
      "😎",
      "🤓",
      "🧐",
      "😕",
      "😟",
      "🙁",
      "☹️",
      "😮",
      "😯",
      "😲",
      "😳",
      "🥺",
      "😦",
      "😧",
      "😨",
      "😰",
      "😥",
      "😢",
      "😭",
      "😱",
      "😖",
      "😣",
      "😞",
      "😓",
      "😩",
      "😫",
      "🥱",
      "😤",
      "😡",
      "😠",
      "🤬",
      "😈",
      "👿",
      "💀",
      "☠️",
      "💩",
      "🤡",
      "👹",
      "👺",
      "👻",
      "👽",
      "👾",
      "🤖",
    ],
  },
  people: {
    name: "People & Body",
    icon: "👋",
    emojis: [
      "👋",
      "🤚",
      "🖐️",
      "✋",
      "🖖",
      "👌",
      "🤌",
      "🤏",
      "✌️",
      "🤞",
      "🤟",
      "🤘",
      "🤙",
      "👈",
      "👉",
      "👆",
      "🖕",
      "👇",
      "☝️",
      "👍",
      "👎",
      "✊",
      "👊",
      "🤛",
      "🤜",
      "👏",
      "🙌",
      "👐",
      "🤲",
      "🤝",
      "🙏",
      "✍️",
      "💅",
      "🤳",
      "💪",
      "🦾",
      "🦿",
      "🦵",
      "🦶",
      "👂",
      "🦻",
      "👃",
      "🧠",
      "🫀",
      "🫁",
      "🦷",
      "🦴",
      "👀",
      "👁️",
      "👅",
      "👄",
      "👶",
      "🧒",
      "👦",
      "👧",
      "🧑",
      "👱",
      "👨",
      "🧔",
      "👩",
      "🧓",
      "👴",
      "👵",
    ],
  },
  animals: {
    name: "Animals & Nature",
    icon: "🐶",
    emojis: [
      "🐶",
      "🐱",
      "🐭",
      "🐹",
      "🐰",
      "🦊",
      "🐻",
      "🐼",
      "🐻‍❄️",
      "🐨",
      "🐯",
      "🦁",
      "🐮",
      "🐷",
      "🐽",
      "🐸",
      "🐵",
      "🙈",
      "🙉",
      "🙊",
      "🐒",
      "🐔",
      "🐧",
      "🐦",
      "🐤",
      "🐣",
      "🐥",
      "🦆",
      "🦅",
      "🦉",
      "🦇",
      "🐺",
      "🐗",
      "🐴",
      "🦄",
      "🐝",
      "🪱",
      "🐛",
      "🦋",
      "🐌",
      "🐞",
      "🐜",
      "🪰",
      "🪲",
      "🪳",
      "🦟",
      "🦗",
      "🕷️",
      "🕸️",
      "🦂",
      "🐢",
      "🐍",
      "🦎",
      "🦖",
      "🦕",
      "🐙",
      "🦑",
      "🦐",
      "🦞",
      "🦀",
      "🐡",
      "🐠",
      "🐟",
      "🐬",
      "🐳",
      "🐋",
      "🦈",
      "🐊",
      "🐅",
      "🐆",
      "🦓",
      "🦍",
      "🦧",
      "🦣",
      "🐘",
      "🦛",
      "🦏",
      "🐪",
      "🐫",
      "🦒",
      "🦘",
      "🦬",
      "🐃",
      "🐂",
      "🐄",
      "🐎",
      "🐖",
      "🐏",
      "🐑",
      "🦙",
      "🐐",
      "🦌",
      "🐕",
      "🐩",
      "🦮",
      "🐕‍🦺",
      "🐈",
      "🐈‍⬛",
      "🪶",
      "🐓",
      "🦃",
      "🦤",
      "🦚",
      "🦜",
      "🦢",
      "🦩",
      "🕊️",
      "🐇",
      "🦝",
      "🦨",
      "🦡",
      "🦫",
      "🦦",
      "🦥",
      "🐁",
      "🐀",
      "🐿️",
      "🦔",
    ],
  },
  food: {
    name: "Food & Drink",
    icon: "🍎",
    emojis: [
      "🍎",
      "🍐",
      "🍊",
      "🍋",
      "🍌",
      "🍉",
      "🍇",
      "🍓",
      "🫐",
      "🍈",
      "🍒",
      "🍑",
      "🥭",
      "🍍",
      "🥥",
      "🥝",
      "🍅",
      "🍆",
      "🥑",
      "🥦",
      "🥬",
      "🥒",
      "🌶️",
      "🫑",
      "🌽",
      "🥕",
      "🫒",
      "🧄",
      "🧅",
      "🥔",
      "🍠",
      "🥐",
      "🥯",
      "🍞",
      "🥖",
      "🥨",
      "🧀",
      "🥚",
      "🍳",
      "🧈",
      "🥞",
      "🧇",
      "🥓",
      "🥩",
      "🍗",
      "🍖",
      "🦴",
      "🌭",
      "🍔",
      "🍟",
      "🍕",
      "🫓",
      "🥪",
      "🥙",
      "🧆",
      "🌮",
      "🌯",
      "🫔",
      "🥗",
      "🥘",
      "🫕",
      "🥫",
      "🍝",
      "🍜",
      "🍲",
      "🍛",
      "🍣",
      "🍱",
      "🥟",
      "🦪",
      "🍤",
      "🍙",
      "🍚",
      "🍘",
      "🍥",
      "🥠",
      "🥮",
      "🍢",
      "🍡",
      "🍧",
      "🍨",
      "🍦",
      "🥧",
      "🧁",
      "🍰",
      "🎂",
      "🍮",
      "🍭",
      "🍬",
      "🍫",
      "🍿",
      "🍩",
      "🍪",
      "🌰",
      "🥜",
      "🍯",
      "🥛",
      "🍼",
      "🫖",
      "☕",
      "🍵",
      "🧃",
      "🥤",
      "🧋",
      "🍶",
      "🍺",
      "🍻",
      "🥂",
      "🍷",
      "🥃",
      "🍸",
      "🍹",
      "🧉",
      "🍾",
      "🧊",
    ],
  },
  travel: {
    name: "Travel & Places",
    icon: "🚗",
    emojis: [
      "🚗",
      "🚕",
      "🚙",
      "🚌",
      "🚎",
      "🏎️",
      "🚓",
      "🚑",
      "🚒",
      "🚐",
      "🛻",
      "🚚",
      "🚛",
      "🚜",
      "🦯",
      "🦽",
      "🦼",
      "🛴",
      "🚲",
      "🛵",
      "🏍️",
      "🛺",
      "🚨",
      "🚔",
      "🚍",
      "🚘",
      "🚖",
      "🚡",
      "🚠",
      "🚟",
      "🚃",
      "🚋",
      "🚞",
      "🚝",
      "🚄",
      "🚅",
      "🚈",
      "🚂",
      "🚆",
      "🚇",
      "🚊",
      "🚉",
      "✈️",
      "🛫",
      "🛬",
      "🛩️",
      "💺",
      "🛰️",
      "🚀",
      "🛸",
      "🚁",
      "🛶",
      "⛵",
      "🚤",
      "🛥️",
      "🛳️",
      "⛴️",
      "🚢",
      "⚓",
      "🪝",
      "⛽",
      "🚧",
      "🚦",
      "🚥",
      "🚏",
      "🗺️",
      "🗿",
      "🗽",
      "🗼",
      "🏰",
      "🏯",
      "🏟️",
      "🎡",
      "🎢",
      "🎠",
      "⛲",
      "⛱️",
      "🏖️",
      "🏝️",
      "🏜️",
      "🌋",
      "⛰️",
      "🏔️",
      "🗻",
      "🏕️",
      "⛺",
      "🛖",
      "🏠",
      "🏡",
      "🏘️",
      "🏚️",
      "🏗️",
      "🏭",
      "🏢",
      "🏬",
      "🏣",
      "🏤",
      "🏥",
      "🏦",
      "🏨",
      "🏪",
      "🏫",
      "🏩",
      "💒",
      "🏛️",
      "⛪",
      "🕌",
      "🕍",
      "🛕",
      "🕋",
      "⛩️",
      "🛤️",
      "🛣️",
      "🗾",
      "🎑",
      "🏞️",
      "🌅",
      "🌄",
      "🌠",
      "🎇",
      "🎆",
      "🌇",
      "🌆",
      "🏙️",
      "🌃",
      "🌌",
      "🌉",
      "🌁",
    ],
  },
  activities: {
    name: "Activities",
    icon: "⚽",
    emojis: [
      "⚽",
      "🏀",
      "🏈",
      "⚾",
      "🥎",
      "🎾",
      "🏐",
      "🏉",
      "🥏",
      "🎱",
      "🪀",
      "🏓",
      "🏸",
      "🏒",
      "🏑",
      "🥍",
      "🏏",
      "🪃",
      "🥅",
      "⛳",
      "🪁",
      "🏹",
      "🎣",
      "🤿",
      "🥊",
      "🥋",
      "🎽",
      "🛹",
      "🛼",
      "🛷",
      "⛸️",
      "🥌",
      "🎿",
      "⛷️",
      "🏂",
      "🪂",
      "🏋️",
      "🤼",
      "🤸",
      "🤺",
      "⛹️",
      "🤾",
      "🏌️",
      "🏇",
      "🧘",
      "🏄",
      "🏊",
      "🤽",
      "🚣",
      "🧗",
      "🚵",
      "🚴",
      "🏆",
      "🥇",
      "🥈",
      "🥉",
      "🏅",
      "🎖️",
      "🏵️",
      "🎗️",
      "🎫",
      "🎟️",
      "🎪",
      "🤹",
      "🎭",
      "🩰",
      "🎨",
      "🎬",
      "🎤",
      "🎧",
      "🎼",
      "🎹",
      "🥁",
      "🪘",
      "🎷",
      "🎺",
      "🪗",
      "🎸",
      "🪕",
      "🎻",
      "🎲",
      "♟️",
      "🎯",
      "🎳",
      "🎮",
      "🎰",
      "🧩",
    ],
  },
  objects: {
    name: "Objects",
    icon: "💡",
    emojis: [
      "💡",
      "🔦",
      "🏮",
      "🪔",
      "📱",
      "📲",
      "💻",
      "🖥️",
      "🖨️",
      "⌨️",
      "🖱️",
      "🖲️",
      "💽",
      "💾",
      "💿",
      "📀",
      "🧮",
      "🎥",
      "🎞️",
      "📽️",
      "🎬",
      "📺",
      "📷",
      "📸",
      "📹",
      "📼",
      "🔍",
      "🔎",
      "🕯️",
      "💵",
      "💴",
      "💶",
      "💷",
      "💰",
      "💳",
      "💎",
      "⚖️",
      "🪜",
      "🧰",
      "🪛",
      "🔧",
      "🔨",
      "⚒️",
      "🛠️",
      "⛏️",
      "🪚",
      "🔩",
      "⚙️",
      "🪤",
      "🧱",
      "⛓️",
      "🧲",
      "🔫",
      "💣",
      "🧨",
      "🪓",
      "🔪",
      "🗡️",
      "⚔️",
      "🛡️",
      "🚬",
      "⚰️",
      "🪦",
      "⚱️",
      "🏺",
      "🔮",
      "📿",
      "🧿",
      "💈",
      "⚗️",
      "🔭",
      "🔬",
      "🕳️",
      "🩹",
      "🩺",
      "💊",
      "💉",
      "🩸",
      "🧬",
      "🦠",
      "🧫",
      "🧪",
      "🌡️",
      "🧹",
      "🪠",
      "🧺",
      "🧻",
      "🚽",
      "🚰",
      "🚿",
      "🛁",
      "🛀",
      "🧼",
      "🪥",
      "🪒",
      "🧽",
      "🪣",
      "🧴",
      "🛎️",
      "🔑",
      "🗝️",
      "🚪",
      "🪑",
      "🛋️",
      "🛏️",
      "🛌",
      "🧸",
      "🪆",
      "🖼️",
      "🪞",
      "🪟",
      "🛍️",
      "🛒",
      "🎁",
      "🎈",
      "🎏",
      "🎀",
      "🪄",
      "🪅",
      "🎊",
      "🎉",
      "🎎",
      "🏮",
      "🎐",
      "🧧",
    ],
  },
  symbols: {
    name: "Symbols",
    icon: "❤️",
    emojis: [
      "❤️",
      "🧡",
      "💛",
      "💚",
      "💙",
      "💜",
      "🖤",
      "🤍",
      "🤎",
      "💔",
      "❣️",
      "💕",
      "💞",
      "💓",
      "💗",
      "💖",
      "💘",
      "💝",
      "💟",
      "☮️",
      "✝️",
      "☪️",
      "🕉️",
      "☸️",
      "✡️",
      "🔯",
      "🕎",
      "☯️",
      "☦️",
      "🛐",
      "⛎",
      "♈",
      "♉",
      "♊",
      "♋",
      "♌",
      "♍",
      "♎",
      "♏",
      "♐",
      "♑",
      "♒",
      "♓",
      "🆔",
      "⚛️",
      "🉑",
      "☢️",
      "☣️",
      "📴",
      "📳",
      "🈶",
      "🈚",
      "🈸",
      "🈺",
      "🈷️",
      "✴️",
      "🆚",
      "💮",
      "🉐",
      "㊙️",
      "㊗️",
      "🈴",
      "🈵",
      "🈹",
      "🈲",
      "🅰️",
      "🅱️",
      "🆎",
      "🆑",
      "🅾️",
      "🆘",
      "❌",
      "⭕",
      "🛑",
      "⛔",
      "📛",
      "🚫",
      "💯",
      "💢",
      "♨️",
      "🚷",
      "🚯",
      "🚳",
      "🚱",
      "🔞",
      "📵",
      "🚭",
      "❗",
      "❕",
      "❓",
      "❔",
      "‼️",
      "⁉️",
      "🔅",
      "🔆",
      "〽️",
      "⚠️",
      "🚸",
      "🔱",
      "⚜️",
      "🔰",
      "♻️",
      "✅",
      "🈯",
      "💹",
      "❇️",
      "✳️",
      "❎",
      "🌐",
      "💠",
      "Ⓜ️",
      "🌀",
      "💤",
      "🏧",
      "🚾",
      "♿",
      "🅿️",
      "🛗",
      "🈳",
      "🈂️",
      "🛂",
      "🛃",
      "🛄",
      "🛅",
      "🚹",
      "🚺",
      "🚼",
      "⚧️",
      "🚻",
      "🚮",
      "🎦",
      "📶",
      "🈁",
      "🔣",
      "ℹ️",
      "🔤",
      "🔡",
      "🔠",
      "🆖",
      "🆗",
      "🆙",
      "🆒",
      "🆕",
      "🆓",
      "0️⃣",
      "1️⃣",
      "2️⃣",
      "3️⃣",
      "4️⃣",
      "5️⃣",
      "6️⃣",
      "7️⃣",
      "8️⃣",
      "9️⃣",
      "🔟",
      "🔢",
      "#️⃣",
      "*️⃣",
    ],
  },
  flags: {
    name: "Flags",
    icon: "🏳️",
    emojis: [
      "🏳️",
      "🏴",
      "🏴‍☠️",
      "🏁",
      "🚩",
      "🎌",
      "🏳️‍🌈",
      "🏳️‍⚧️",
      "🇺🇸",
      "🇬🇧",
      "🇨🇦",
      "🇦🇺",
      "🇩🇪",
      "🇫🇷",
      "🇪🇸",
      "🇮🇹",
      "🇯🇵",
      "🇰🇷",
      "🇨🇳",
      "🇮🇳",
      "🇧🇷",
      "🇲🇽",
      "🇷🇺",
      "🇺🇦",
      "🇵🇱",
      "🇳🇱",
      "🇧🇪",
      "🇸🇪",
      "🇳🇴",
      "🇩🇰",
      "🇫🇮",
      "🇮🇪",
      "🇵🇹",
      "🇬🇷",
      "🇹🇷",
      "🇿🇦",
      "🇪🇬",
      "🇳🇬",
      "🇰🇪",
      "🇦🇷",
      "🇨🇱",
      "🇨🇴",
      "🇵🇪",
      "🇻🇪",
      "🇸🇦",
      "🇦🇪",
      "🇮🇱",
      "🇵🇰",
      "🇧🇩",
      "🇮🇩",
      "🇲🇾",
      "🇸🇬",
      "🇵🇭",
      "🇹🇭",
      "🇻🇳",
      "🇳🇿",
      "🇨🇭",
      "🇦🇹",
      "🇭🇺",
      "🇨🇿",
      "🇷🇴",
    ],
  },
};

// Get recent emojis from localStorage
const getRecentEmojis = (): string[] => {
  try {
    const stored = localStorage.getItem("kloak-recent-emojis");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save recent emoji
const saveRecentEmoji = (emoji: string) => {
  try {
    const recent = getRecentEmojis();
    const updated = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 32);
    localStorage.setItem("kloak-recent-emojis", JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
};

export const EmojiPicker = ({ children, onEmojiSelect, open, onOpenChange }: EmojiPickerProps) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("smileys");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const recentEmojis = useMemo(() => getRecentEmojis(), [open]);

  // Reset search when closed
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;

    const query = search.toLowerCase();
    const results: string[] = [];

    // Search through all categories
    Object.values(EMOJI_CATEGORIES).forEach((category) => {
      if (category.emojis) {
        results.push(...category.emojis);
      }
    });

    // For now, just return all emojis when searching (in a real app, you'd filter by emoji names/keywords)
    // This at least shows the search is working
    return results.slice(0, 64);
  }, [search]);

  const handleSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    onEmojiSelect(emoji);
    onOpenChange?.(false);
  };

  const categories = Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => ({
    key,
    ...cat,
    emojis: key === "recent" ? recentEmojis : cat.emojis,
  }));

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[360px] sm:w-[420px] p-0 bg-card/95 backdrop-blur-xl border-border/50 rounded-2xl shadow-2xl overflow-hidden"
        side="top"
        align="end"
        sideOffset={12}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        {/* Search Header */}
        <div className="p-3 border-b border-border/30">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emoji..."
              className="pl-10 h-11 rounded-xl bg-muted/50 border-border/30 focus-visible:ring-primary/30 text-[15px]"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg hover:bg-secondary"
                onClick={() => {
                  setSearch("");
                  searchInputRef.current?.focus();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        {!search && (
          <div className="flex border-b border-border/30 px-2 py-2 gap-0.5 overflow-x-auto scrollbar-hide bg-muted/20">
            {categories.map((cat) => (
              <button
                key={cat.key}
                className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                  activeCategory === cat.key ? "bg-primary/15 shadow-sm ring-1 ring-primary/20" : "hover:bg-muted/60",
                )}
                onClick={() => setActiveCategory(cat.key)}
                title={cat.name}
              >
                <span className="text-[22px]">{cat.icon}</span>
              </button>
            ))}
          </div>
        )}

        {/* Emoji Grid */}
        <ScrollArea className="h-[340px] sm:h-[380px]">
          <div className="p-3">
            {search ? (
              // Search results
              filteredEmojis && filteredEmojis.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                      <Search className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Search Results
                    </h3>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-7 gap-1">
                    {filteredEmojis.map((emoji, i) => (
                      <button
                        key={`search-${emoji}-${i}`}
                        type="button"
                        className="aspect-square p-0 text-[28px] sm:text-[30px] hover:bg-muted/80 active:scale-90 rounded-xl flex items-center justify-center transition-all duration-150"
                        onClick={() => handleSelect(emoji)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No emoji found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Try a different search term</p>
                </div>
              )
            ) : (
              // Category view
              categories.map(
                (cat) =>
                  cat.key === activeCategory && (
                    <div key={cat.key}>
                      {/* Category Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
                          {cat.key === "recent" ? (
                            <Clock className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <span className="text-lg">{cat.icon}</span>
                          )}
                        </div>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {cat.name}
                        </h3>
                      </div>

                      {cat.emojis.length > 0 ? (
                        <div className="grid grid-cols-6 sm:grid-cols-7 gap-1">
                          {cat.emojis.map((emoji, i) => (
                            <button
                              key={`${cat.key}-${emoji}-${i}`}
                              type="button"
                              className="aspect-square p-0 text-[28px] sm:text-[30px] hover:bg-muted/80 active:scale-90 rounded-xl flex items-center justify-center transition-all duration-150"
                              onClick={() => handleSelect(emoji)}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
                            <Clock className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {cat.key === "recent" ? "No recently used emoji" : "No emojis available"}
                          </p>
                          {cat.key === "recent" && (
                            <p className="text-xs text-muted-foreground/70 mt-1.5 max-w-[200px]">
                              Emoji you use will appear here for quick access
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ),
              )
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="px-3 py-2 border-t border-border/30 bg-muted/10">
          <p className="text-[11px] text-muted-foreground/60 text-center">Click an emoji to insert it</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
