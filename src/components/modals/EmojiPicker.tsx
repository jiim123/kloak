import { useState, useMemo, useRef, useEffect } from "react";
import { Search, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [activeCategory, setActiveCategory] = useState("recent");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const recentEmojis = useMemo(() => getRecentEmojis(), [open]);

  // Check scroll state for category bar
  const updateScrollState = () => {
    const container = categoryScrollRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }
  };

  // Scroll category bar
  const scrollCategories = (direction: "left" | "right") => {
    const container = categoryScrollRef.current;
    if (container) {
      const scrollAmount = 120;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Reset search when closed, default to recent if we have recent emojis
  useEffect(() => {
    if (!open) {
      setSearch("");
    } else {
      // When opening, show recent if available, otherwise smileys
      const recent = getRecentEmojis();
      setActiveCategory(recent.length > 0 ? "recent" : "smileys");
      // Check scroll state after render
      setTimeout(updateScrollState, 100);
    }
  }, [open]);

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;

    const results: string[] = [];

    // Search through all categories
    Object.values(EMOJI_CATEGORIES).forEach((category) => {
      if (category.emojis) {
        results.push(...category.emojis);
      }
    });

    return results.slice(0, 50);
  }, [search]);

  const handleSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    onEmojiSelect(emoji);
    onOpenChange?.(false);
  };

  // Build categories with recent first
  const categories = useMemo(() => {
    return Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => ({
      key,
      ...cat,
      emojis: key === "recent" ? recentEmojis : cat.emojis,
    }));
  }, [recentEmojis]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] sm:w-[420px] p-0 bg-card border-border/50 rounded-2xl shadow-2xl overflow-hidden"
        side="top"
        align="end"
        sideOffset={12}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
        }}
      >
        {/* Search Header */}
        <div className="p-4 pb-3 border-b border-border/30">
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2.5 pointer-events-none">
              <Search className="w-[18px] h-[18px] text-muted-foreground/40" />
              {!search && <span className="text-[15px] text-muted-foreground/40">Search emoji...</span>}
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-14 pl-12 pr-12 rounded-2xl bg-muted/30 border border-border/30 text-[15px] text-foreground outline-none focus:border-primary/30 focus:bg-muted/40 transition-all"
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
        {!search && (
          <div className="relative border-b border-border/30">
            {/* Left scroll indicator */}
            {canScrollLeft && (
              <button
                onClick={() => scrollCategories("left")}
                className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-card via-card/90 to-transparent z-10 flex items-center justify-start pl-1"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
            )}

            {/* Scrollable container */}
            <div
              ref={categoryScrollRef}
              className="flex px-3 py-3 gap-1.5 overflow-x-auto scrollbar-hide scroll-smooth"
              onScroll={updateScrollState}
            >
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  className={cn(
                    "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200",
                    activeCategory === cat.key
                      ? "bg-primary/10 ring-1 ring-primary/20"
                      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveCategory(cat.key)}
                  title={cat.name}
                >
                  {cat.key === "recent" ? (
                    <Clock
                      className={cn(
                        "w-6 h-6 transition-colors",
                        activeCategory === cat.key ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  ) : (
                    <span className="text-[28px] leading-none">{cat.icon}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Right scroll indicator */}
            {canScrollRight && (
              <button
                onClick={() => scrollCategories("right")}
                className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-card via-card/90 to-transparent z-10 flex items-center justify-end pr-1"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Emoji Grid */}
        <ScrollArea className="h-[360px] sm:h-[400px]">
          <div className="p-4">
            {search ? (
              // Search results
              filteredEmojis && filteredEmojis.length > 0 ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center">
                      <Search className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Search Results
                    </h3>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {filteredEmojis.map((emoji, i) => (
                      <button
                        key={`search-${emoji}-${i}`}
                        type="button"
                        className="w-[64px] h-[64px] text-[32px] hover:bg-muted/50 active:scale-90 rounded-xl flex items-center justify-center transition-all duration-150"
                        onClick={() => handleSelect(emoji)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No emoji found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1.5">Try a different search term</p>
                </div>
              )
            ) : (
              // Category view
              categories.map(
                (cat) =>
                  cat.key === activeCategory && (
                    <div key={cat.key}>
                      {/* Category Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-muted/40 flex items-center justify-center">
                          {cat.key === "recent" ? (
                            <Clock className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <span className="text-xl">{cat.icon}</span>
                          )}
                        </div>
                        <h3 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {cat.name}
                        </h3>
                      </div>

                      {cat.emojis.length > 0 ? (
                        <div className="grid grid-cols-5 gap-2">
                          {cat.emojis.map((emoji, i) => (
                            <button
                              key={`${cat.key}-${emoji}-${i}`}
                              type="button"
                              className="w-[64px] h-[64px] text-[32px] hover:bg-muted/50 active:scale-90 rounded-xl flex items-center justify-center transition-all duration-150"
                              onClick={() => handleSelect(emoji)}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                          <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                            <Clock className="w-7 h-7 text-muted-foreground/40" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {cat.key === "recent" ? "No recently used emoji" : "No emojis available"}
                          </p>
                          {cat.key === "recent" && (
                            <p className="text-xs text-muted-foreground/60 mt-2 max-w-[220px]">
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
      </PopoverContent>
    </Popover>
  );
};
