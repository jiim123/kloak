import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { Search, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useServerStore } from "@/stores/serverStore";
import { fetchServerEmojis, ServerEmoji } from "@/lib/serverEmojis";
import { getGlobalEmojiDuplicates } from "@/lib/globalEmojiResolver";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface EmojiPickerProps {
  children: React.ReactNode;
  onEmojiSelect: (emoji: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  serverId?: string; // Current server context
}

// Emoji data with keywords for search
const EMOJI_DATA: Record<string, { name: string; icon: string; emojis: Array<{ emoji: string; keywords: string[] }> }> =
  {
    recent: { name: "Recently Used", icon: "🕐", emojis: [] },
    smileys: {
      name: "Smileys & Emotion",
      icon: "😀",
      emojis: [
        { emoji: "😀", keywords: ["grinning", "smile", "happy", "face"] },
        { emoji: "😃", keywords: ["smiley", "happy", "joy", "face"] },
        { emoji: "😄", keywords: ["smile", "happy", "joy", "laugh"] },
        { emoji: "😁", keywords: ["grin", "happy", "smile", "teeth"] },
        { emoji: "😅", keywords: ["sweat", "smile", "nervous", "relief"] },
        { emoji: "😂", keywords: ["joy", "laugh", "tears", "funny", "lol"] },
        { emoji: "🤣", keywords: ["rofl", "laugh", "funny", "lol"] },
        { emoji: "😊", keywords: ["blush", "smile", "happy", "shy"] },
        { emoji: "😇", keywords: ["angel", "innocent", "halo", "blessed"] },
        { emoji: "🙂", keywords: ["smile", "face", "slightly"] },
        { emoji: "🙃", keywords: ["upside", "down", "silly", "sarcasm"] },
        { emoji: "😉", keywords: ["wink", "flirt", "playful"] },
        { emoji: "😌", keywords: ["relieved", "content", "peaceful"] },
        { emoji: "😍", keywords: ["love", "heart", "eyes", "crush", "adore"] },
        { emoji: "🥰", keywords: ["love", "hearts", "affection", "adore"] },
        { emoji: "😘", keywords: ["kiss", "love", "heart", "flirt"] },
        { emoji: "😗", keywords: ["kiss", "whistle", "smooch"] },
        { emoji: "😙", keywords: ["kiss", "smile", "happy"] },
        { emoji: "😚", keywords: ["kiss", "blush", "love"] },
        { emoji: "😋", keywords: ["yummy", "tongue", "tasty", "delicious"] },
        { emoji: "😛", keywords: ["tongue", "playful", "silly"] },
        { emoji: "😜", keywords: ["wink", "tongue", "crazy", "silly"] },
        { emoji: "🤪", keywords: ["zany", "crazy", "wild", "silly"] },
        { emoji: "😝", keywords: ["tongue", "squint", "playful"] },
        { emoji: "🤑", keywords: ["money", "rich", "dollar", "greedy"] },
        { emoji: "🤗", keywords: ["hug", "hugging", "embrace"] },
        { emoji: "🤭", keywords: ["giggle", "shy", "cover", "oops"] },
        { emoji: "🤫", keywords: ["shush", "quiet", "secret", "silent"] },
        { emoji: "🤔", keywords: ["thinking", "hmm", "consider", "ponder"] },
        { emoji: "🤐", keywords: ["zipper", "mouth", "secret", "quiet"] },
        { emoji: "🤨", keywords: ["raised", "eyebrow", "skeptical", "suspicious"] },
        { emoji: "😐", keywords: ["neutral", "meh", "blank", "expressionless"] },
        { emoji: "😑", keywords: ["expressionless", "blank", "meh"] },
        { emoji: "😶", keywords: ["silent", "speechless", "mute", "no mouth"] },
        { emoji: "😏", keywords: ["smirk", "smug", "sly"] },
        { emoji: "😒", keywords: ["unamused", "meh", "bored", "annoyed"] },
        { emoji: "🙄", keywords: ["eye", "roll", "whatever", "annoyed"] },
        { emoji: "😬", keywords: ["grimace", "awkward", "nervous"] },
        { emoji: "😮‍💨", keywords: ["exhale", "sigh", "relief", "tired"] },
        { emoji: "🤥", keywords: ["liar", "pinocchio", "lie"] },
        { emoji: "😔", keywords: ["sad", "pensive", "disappointed"] },
        { emoji: "😪", keywords: ["sleepy", "tired", "tear"] },
        { emoji: "🤤", keywords: ["drool", "hungry", "desire"] },
        { emoji: "😴", keywords: ["sleep", "zzz", "tired", "snore"] },
        { emoji: "😷", keywords: ["mask", "sick", "ill", "covid"] },
        { emoji: "🤒", keywords: ["sick", "fever", "thermometer", "ill"] },
        { emoji: "🤕", keywords: ["hurt", "bandage", "injured"] },
        { emoji: "🤢", keywords: ["nauseated", "sick", "green", "ill"] },
        { emoji: "🤮", keywords: ["vomit", "sick", "puke", "gross"] },
        { emoji: "🤧", keywords: ["sneeze", "sick", "cold", "tissue"] },
        { emoji: "🥵", keywords: ["hot", "heat", "sweat", "warm"] },
        { emoji: "🥶", keywords: ["cold", "freeze", "frozen", "ice"] },
        { emoji: "🥴", keywords: ["woozy", "drunk", "dizzy"] },
        { emoji: "😵", keywords: ["dizzy", "dead", "shocked"] },
        { emoji: "🤯", keywords: ["mind", "blown", "explode", "shocked"] },
        { emoji: "🤠", keywords: ["cowboy", "hat", "western"] },
        { emoji: "🥳", keywords: ["party", "celebrate", "birthday", "hat"] },
        { emoji: "🥸", keywords: ["disguise", "glasses", "nose", "fake"] },
        { emoji: "😎", keywords: ["cool", "sunglasses", "awesome"] },
        { emoji: "🤓", keywords: ["nerd", "geek", "glasses", "smart"] },
        { emoji: "🧐", keywords: ["monocle", "fancy", "inspect"] },
        { emoji: "😕", keywords: ["confused", "unsure", "puzzled"] },
        { emoji: "😟", keywords: ["worried", "concerned", "anxious"] },
        { emoji: "🙁", keywords: ["frown", "sad", "disappointed"] },
        { emoji: "☹️", keywords: ["frown", "sad", "unhappy"] },
        { emoji: "😮", keywords: ["surprised", "wow", "open", "mouth"] },
        { emoji: "😯", keywords: ["hushed", "surprised", "stunned"] },
        { emoji: "😲", keywords: ["astonished", "shocked", "surprised"] },
        { emoji: "😳", keywords: ["flushed", "embarrassed", "shy", "blush"] },
        { emoji: "🥺", keywords: ["pleading", "puppy", "eyes", "cute", "please"] },
        { emoji: "😦", keywords: ["frown", "open", "surprised"] },
        { emoji: "😧", keywords: ["anguished", "worried", "shocked"] },
        { emoji: "😨", keywords: ["fearful", "scared", "shocked"] },
        { emoji: "😰", keywords: ["anxious", "sweat", "nervous", "worried"] },
        { emoji: "😥", keywords: ["sad", "relieved", "disappointed", "sweat"] },
        { emoji: "😢", keywords: ["cry", "tear", "sad"] },
        { emoji: "😭", keywords: ["sob", "cry", "tears", "sad", "bawling"] },
        { emoji: "😱", keywords: ["scream", "scared", "shocked", "horror"] },
        { emoji: "😖", keywords: ["confounded", "frustrated", "stressed"] },
        { emoji: "😣", keywords: ["persevere", "struggle", "frustrated"] },
        { emoji: "😞", keywords: ["disappointed", "sad", "down"] },
        { emoji: "😓", keywords: ["sweat", "downcast", "disappointed"] },
        { emoji: "😩", keywords: ["weary", "tired", "frustrated"] },
        { emoji: "😫", keywords: ["tired", "exhausted", "frustrated"] },
        { emoji: "🥱", keywords: ["yawn", "tired", "sleepy", "bored"] },
        { emoji: "😤", keywords: ["triumph", "angry", "steam", "huffing"] },
        { emoji: "😡", keywords: ["angry", "mad", "pouting", "rage"] },
        { emoji: "😠", keywords: ["angry", "mad", "annoyed"] },
        { emoji: "🤬", keywords: ["swear", "curse", "angry", "mad", "symbols"] },
        { emoji: "😈", keywords: ["devil", "evil", "smiling", "horns"] },
        { emoji: "👿", keywords: ["devil", "angry", "evil", "imp"] },
        { emoji: "💀", keywords: ["skull", "dead", "death", "skeleton"] },
        { emoji: "☠️", keywords: ["skull", "crossbones", "death", "danger"] },
        { emoji: "💩", keywords: ["poop", "poo", "shit", "crap"] },
        { emoji: "🤡", keywords: ["clown", "funny", "circus"] },
        { emoji: "👹", keywords: ["ogre", "monster", "demon", "red"] },
        { emoji: "👺", keywords: ["goblin", "monster", "tengu", "red"] },
        { emoji: "👻", keywords: ["ghost", "boo", "halloween", "spooky"] },
        { emoji: "👽", keywords: ["alien", "ufo", "space", "extraterrestrial"] },
        { emoji: "👾", keywords: ["alien", "monster", "game", "space", "invader"] },
        { emoji: "🤖", keywords: ["robot", "bot", "machine", "ai"] },
      ],
    },
    people: {
      name: "People & Body",
      icon: "👋",
      emojis: [
        { emoji: "👋", keywords: ["wave", "hello", "hi", "bye", "hand"] },
        { emoji: "🤚", keywords: ["raised", "back", "hand", "stop"] },
        { emoji: "🖐️", keywords: ["hand", "fingers", "splayed", "five"] },
        { emoji: "✋", keywords: ["hand", "stop", "high", "five"] },
        { emoji: "🖖", keywords: ["vulcan", "spock", "star", "trek"] },
        { emoji: "👌", keywords: ["ok", "okay", "perfect", "good"] },
        { emoji: "🤌", keywords: ["pinched", "fingers", "italian", "chef"] },
        { emoji: "🤏", keywords: ["pinch", "small", "tiny", "little"] },
        { emoji: "✌️", keywords: ["peace", "victory", "two", "fingers"] },
        { emoji: "🤞", keywords: ["crossed", "fingers", "luck", "hope"] },
        { emoji: "🤟", keywords: ["love", "you", "rock", "hand"] },
        { emoji: "🤘", keywords: ["rock", "horns", "metal", "devil"] },
        { emoji: "🤙", keywords: ["call", "me", "shaka", "hang", "loose"] },
        { emoji: "👈", keywords: ["point", "left", "finger"] },
        { emoji: "👉", keywords: ["point", "right", "finger"] },
        { emoji: "👆", keywords: ["point", "up", "finger"] },
        { emoji: "🖕", keywords: ["middle", "finger", "rude"] },
        { emoji: "👇", keywords: ["point", "down", "finger"] },
        { emoji: "☝️", keywords: ["point", "up", "one", "finger"] },
        { emoji: "👍", keywords: ["thumbs", "up", "good", "like", "yes"] },
        { emoji: "👎", keywords: ["thumbs", "down", "bad", "dislike", "no"] },
        { emoji: "✊", keywords: ["fist", "punch", "power", "raised"] },
        { emoji: "👊", keywords: ["fist", "bump", "punch", "bro"] },
        { emoji: "🤛", keywords: ["fist", "left", "bump"] },
        { emoji: "🤜", keywords: ["fist", "right", "bump"] },
        { emoji: "👏", keywords: ["clap", "applause", "congrats", "bravo"] },
        { emoji: "🙌", keywords: ["hands", "raised", "celebration", "hooray"] },
        { emoji: "👐", keywords: ["hands", "open", "jazz"] },
        { emoji: "🤲", keywords: ["palms", "together", "hands"] },
        { emoji: "🤝", keywords: ["handshake", "deal", "agree", "shake"] },
        { emoji: "🙏", keywords: ["pray", "please", "thanks", "hope", "namaste"] },
        { emoji: "✍️", keywords: ["write", "writing", "hand", "pen"] },
        { emoji: "💅", keywords: ["nail", "polish", "manicure", "beauty"] },
        { emoji: "🤳", keywords: ["selfie", "phone", "camera"] },
        { emoji: "💪", keywords: ["muscle", "strong", "flex", "bicep", "arm"] },
        { emoji: "🦾", keywords: ["robot", "arm", "prosthetic", "mechanical"] },
        { emoji: "🦿", keywords: ["leg", "prosthetic", "mechanical"] },
        { emoji: "🦵", keywords: ["leg", "kick", "limb"] },
        { emoji: "🦶", keywords: ["foot", "kick", "stomp"] },
        { emoji: "👂", keywords: ["ear", "listen", "hear"] },
        { emoji: "🦻", keywords: ["ear", "hearing", "aid"] },
        { emoji: "👃", keywords: ["nose", "smell", "sniff"] },
        { emoji: "🧠", keywords: ["brain", "think", "smart", "mind"] },
        { emoji: "🫀", keywords: ["heart", "anatomical", "organ"] },
        { emoji: "🫁", keywords: ["lungs", "breathe", "organ"] },
        { emoji: "🦷", keywords: ["tooth", "teeth", "dentist"] },
        { emoji: "🦴", keywords: ["bone", "skeleton"] },
        { emoji: "👀", keywords: ["eyes", "look", "see", "watch"] },
        { emoji: "👁️", keywords: ["eye", "see", "look"] },
        { emoji: "👅", keywords: ["tongue", "taste", "lick"] },
        { emoji: "👄", keywords: ["lips", "mouth", "kiss"] },
        { emoji: "👶", keywords: ["baby", "infant", "child"] },
        { emoji: "🧒", keywords: ["child", "kid", "young"] },
        { emoji: "👦", keywords: ["boy", "child", "male", "kid"] },
        { emoji: "👧", keywords: ["girl", "child", "female", "kid"] },
        { emoji: "🧑", keywords: ["person", "adult", "gender", "neutral"] },
        { emoji: "👱", keywords: ["blonde", "person", "hair"] },
        { emoji: "👨", keywords: ["man", "male", "adult", "guy"] },
        { emoji: "🧔", keywords: ["beard", "man", "facial", "hair"] },
        { emoji: "👩", keywords: ["woman", "female", "adult", "lady"] },
        { emoji: "🧓", keywords: ["older", "person", "adult", "elder"] },
        { emoji: "👴", keywords: ["old", "man", "grandpa", "elder"] },
        { emoji: "👵", keywords: ["old", "woman", "grandma", "elder"] },
      ],
    },
    animals: {
      name: "Animals & Nature",
      icon: "🐶",
      emojis: [
        { emoji: "🐶", keywords: ["dog", "puppy", "pet", "face"] },
        { emoji: "🐱", keywords: ["cat", "kitten", "pet", "face"] },
        { emoji: "🐭", keywords: ["mouse", "rat", "face"] },
        { emoji: "🐹", keywords: ["hamster", "pet", "face"] },
        { emoji: "🐰", keywords: ["rabbit", "bunny", "face", "pet"] },
        { emoji: "🦊", keywords: ["fox", "face", "animal"] },
        { emoji: "🐻", keywords: ["bear", "face", "animal"] },
        { emoji: "🐼", keywords: ["panda", "bear", "face"] },
        { emoji: "🐻‍❄️", keywords: ["polar", "bear", "white", "arctic"] },
        { emoji: "🐨", keywords: ["koala", "face", "animal"] },
        { emoji: "🐯", keywords: ["tiger", "face", "animal"] },
        { emoji: "🦁", keywords: ["lion", "face", "king", "animal"] },
        { emoji: "🐮", keywords: ["cow", "face", "animal"] },
        { emoji: "🐷", keywords: ["pig", "face", "animal"] },
        { emoji: "🐽", keywords: ["pig", "nose", "snout"] },
        { emoji: "🐸", keywords: ["frog", "face", "animal"] },
        { emoji: "🐵", keywords: ["monkey", "face", "animal"] },
        { emoji: "🙈", keywords: ["monkey", "see", "no", "evil"] },
        { emoji: "🙉", keywords: ["monkey", "hear", "no", "evil"] },
        { emoji: "🙊", keywords: ["monkey", "speak", "no", "evil"] },
        { emoji: "🐔", keywords: ["chicken", "bird", "animal"] },
        { emoji: "🐧", keywords: ["penguin", "bird", "animal"] },
        { emoji: "🐦", keywords: ["bird", "animal"] },
        { emoji: "🦆", keywords: ["duck", "bird", "animal"] },
        { emoji: "🦅", keywords: ["eagle", "bird", "animal"] },
        { emoji: "🦉", keywords: ["owl", "bird", "animal", "wise"] },
        { emoji: "🐺", keywords: ["wolf", "animal", "face"] },
        { emoji: "🐴", keywords: ["horse", "face", "animal"] },
        { emoji: "🦄", keywords: ["unicorn", "horse", "magic", "fantasy"] },
        { emoji: "🐝", keywords: ["bee", "honey", "insect"] },
        { emoji: "🦋", keywords: ["butterfly", "insect", "pretty"] },
        { emoji: "🐌", keywords: ["snail", "slow", "animal"] },
        { emoji: "🐞", keywords: ["ladybug", "insect", "bug"] },
        { emoji: "🐢", keywords: ["turtle", "slow", "animal"] },
        { emoji: "🐍", keywords: ["snake", "reptile", "animal"] },
        { emoji: "🐙", keywords: ["octopus", "animal", "sea"] },
        { emoji: "🦑", keywords: ["squid", "animal", "sea"] },
        { emoji: "🦀", keywords: ["crab", "animal", "sea"] },
        { emoji: "🐡", keywords: ["fish", "blowfish", "sea"] },
        { emoji: "🐠", keywords: ["fish", "tropical", "sea"] },
        { emoji: "🐟", keywords: ["fish", "animal", "sea"] },
        { emoji: "🐬", keywords: ["dolphin", "animal", "sea", "flipper"] },
        { emoji: "🐳", keywords: ["whale", "animal", "sea", "spouting"] },
        { emoji: "🐋", keywords: ["whale", "animal", "sea"] },
        { emoji: "🦈", keywords: ["shark", "animal", "sea", "jaws"] },
        { emoji: "🐊", keywords: ["crocodile", "alligator", "animal"] },
        { emoji: "🐘", keywords: ["elephant", "animal", "big"] },
        { emoji: "🦒", keywords: ["giraffe", "animal", "tall"] },
        { emoji: "🦓", keywords: ["zebra", "animal", "stripes"] },
        { emoji: "🐕", keywords: ["dog", "pet", "animal"] },
        { emoji: "🐈", keywords: ["cat", "pet", "animal"] },
        { emoji: "🐇", keywords: ["rabbit", "bunny", "animal"] },
        { emoji: "🦔", keywords: ["hedgehog", "animal", "spiky"] },
      ],
    },
    food: {
      name: "Food & Drink",
      icon: "🍎",
      emojis: [
        { emoji: "🍎", keywords: ["apple", "red", "fruit"] },
        { emoji: "🍐", keywords: ["pear", "fruit"] },
        { emoji: "🍊", keywords: ["orange", "tangerine", "fruit"] },
        { emoji: "🍋", keywords: ["lemon", "citrus", "fruit"] },
        { emoji: "🍌", keywords: ["banana", "fruit"] },
        { emoji: "🍉", keywords: ["watermelon", "fruit", "summer"] },
        { emoji: "🍇", keywords: ["grapes", "fruit", "wine"] },
        { emoji: "🍓", keywords: ["strawberry", "fruit", "berry"] },
        { emoji: "🍒", keywords: ["cherry", "cherries", "fruit"] },
        { emoji: "🍑", keywords: ["peach", "fruit"] },
        { emoji: "🍍", keywords: ["pineapple", "fruit", "tropical"] },
        { emoji: "🥝", keywords: ["kiwi", "fruit"] },
        { emoji: "🍅", keywords: ["tomato", "vegetable", "red"] },
        { emoji: "🥑", keywords: ["avocado", "fruit", "guacamole"] },
        { emoji: "🥦", keywords: ["broccoli", "vegetable", "green"] },
        { emoji: "🥕", keywords: ["carrot", "vegetable", "orange"] },
        { emoji: "🌽", keywords: ["corn", "vegetable", "maize"] },
        { emoji: "🥔", keywords: ["potato", "vegetable"] },
        { emoji: "🍞", keywords: ["bread", "loaf", "toast"] },
        { emoji: "🥐", keywords: ["croissant", "bread", "french"] },
        { emoji: "🧀", keywords: ["cheese", "dairy"] },
        { emoji: "🥚", keywords: ["egg", "food", "breakfast"] },
        { emoji: "🍳", keywords: ["egg", "frying", "breakfast", "cooking"] },
        { emoji: "🥓", keywords: ["bacon", "meat", "breakfast"] },
        { emoji: "🍔", keywords: ["burger", "hamburger", "fast", "food"] },
        { emoji: "🍟", keywords: ["fries", "french", "fast", "food"] },
        { emoji: "🍕", keywords: ["pizza", "food", "italian"] },
        { emoji: "🌭", keywords: ["hotdog", "food", "fast"] },
        { emoji: "🥪", keywords: ["sandwich", "food", "lunch"] },
        { emoji: "🌮", keywords: ["taco", "mexican", "food"] },
        { emoji: "🌯", keywords: ["burrito", "mexican", "food"] },
        { emoji: "🥗", keywords: ["salad", "healthy", "food"] },
        { emoji: "🍝", keywords: ["spaghetti", "pasta", "italian"] },
        { emoji: "🍜", keywords: ["noodles", "ramen", "asian"] },
        { emoji: "🍲", keywords: ["pot", "stew", "food"] },
        { emoji: "🍱", keywords: ["bento", "box", "japanese"] },
        { emoji: "🍣", keywords: ["sushi", "japanese", "food"] },
        { emoji: "🍤", keywords: ["shrimp", "tempura", "food"] },
        { emoji: "🍩", keywords: ["donut", "doughnut", "dessert"] },
        { emoji: "🍪", keywords: ["cookie", "dessert", "snack"] },
        { emoji: "🎂", keywords: ["birthday", "cake", "dessert"] },
        { emoji: "🍰", keywords: ["cake", "slice", "dessert"] },
        { emoji: "🧁", keywords: ["cupcake", "dessert", "sweet"] },
        { emoji: "🍫", keywords: ["chocolate", "candy", "sweet"] },
        { emoji: "🍬", keywords: ["candy", "sweet", "sugar"] },
        { emoji: "🍭", keywords: ["lollipop", "candy", "sweet"] },
        { emoji: "🍦", keywords: ["ice", "cream", "dessert", "soft", "serve"] },
        { emoji: "🍨", keywords: ["ice", "cream", "dessert"] },
        { emoji: "☕", keywords: ["coffee", "hot", "drink", "cafe"] },
        { emoji: "🍵", keywords: ["tea", "green", "drink", "cup"] },
        { emoji: "🥤", keywords: ["cup", "straw", "drink", "soda"] },
        { emoji: "🍺", keywords: ["beer", "drink", "alcohol", "mug"] },
        { emoji: "🍻", keywords: ["beers", "cheers", "drink", "alcohol"] },
        { emoji: "🥂", keywords: ["champagne", "cheers", "drink", "toast"] },
        { emoji: "🍷", keywords: ["wine", "drink", "alcohol", "glass"] },
      ],
    },
    activities: {
      name: "Activities",
      icon: "⚽",
      emojis: [
        { emoji: "⚽", keywords: ["soccer", "ball", "sport", "football"] },
        { emoji: "🏀", keywords: ["basketball", "ball", "sport"] },
        { emoji: "🏈", keywords: ["football", "american", "sport"] },
        { emoji: "⚾", keywords: ["baseball", "ball", "sport"] },
        { emoji: "🥎", keywords: ["softball", "ball", "sport"] },
        { emoji: "🎾", keywords: ["tennis", "ball", "sport"] },
        { emoji: "🏐", keywords: ["volleyball", "ball", "sport"] },
        { emoji: "🏉", keywords: ["rugby", "ball", "sport"] },
        { emoji: "🎱", keywords: ["pool", "billiard", "8ball"] },
        { emoji: "🏓", keywords: ["ping", "pong", "table", "tennis"] },
        { emoji: "🏸", keywords: ["badminton", "sport"] },
        { emoji: "🥅", keywords: ["goal", "net", "sport"] },
        { emoji: "⛳", keywords: ["golf", "flag", "hole"] },
        { emoji: "🏒", keywords: ["hockey", "ice", "sport"] },
        { emoji: "🎿", keywords: ["ski", "skiing", "snow", "winter"] },
        { emoji: "⛷️", keywords: ["skier", "skiing", "snow", "winter"] },
        { emoji: "🏂", keywords: ["snowboard", "snow", "winter"] },
        { emoji: "🏋️", keywords: ["weightlifting", "gym", "fitness"] },
        { emoji: "🚴", keywords: ["cycling", "bike", "bicycle"] },
        { emoji: "🏊", keywords: ["swimming", "pool", "water"] },
        { emoji: "🧘", keywords: ["yoga", "meditation", "fitness"] },
        { emoji: "🎯", keywords: ["target", "dart", "bullseye"] },
        { emoji: "🎮", keywords: ["game", "video", "controller", "gaming"] },
        { emoji: "🕹️", keywords: ["joystick", "game", "arcade"] },
        { emoji: "🎲", keywords: ["dice", "game", "chance"] },
        { emoji: "🧩", keywords: ["puzzle", "piece", "game"] },
        { emoji: "♟️", keywords: ["chess", "pawn", "game"] },
        { emoji: "🎭", keywords: ["theater", "drama", "arts", "masks"] },
        { emoji: "🎨", keywords: ["art", "palette", "paint", "artist"] },
        { emoji: "🎬", keywords: ["movie", "film", "clapper", "cinema"] },
        { emoji: "🎤", keywords: ["microphone", "karaoke", "sing"] },
        { emoji: "🎧", keywords: ["headphones", "music", "listen"] },
        { emoji: "🎼", keywords: ["music", "score", "notes"] },
        { emoji: "🎹", keywords: ["piano", "keyboard", "music"] },
        { emoji: "🎷", keywords: ["saxophone", "music", "jazz"] },
        { emoji: "🎺", keywords: ["trumpet", "music", "brass"] },
        { emoji: "🎸", keywords: ["guitar", "music", "rock"] },
        { emoji: "🎻", keywords: ["violin", "music", "classical"] },
        { emoji: "🥁", keywords: ["drum", "music", "beat"] },
      ],
    },
    travel: {
      name: "Travel & Places",
      icon: "🚗",
      emojis: [
        { emoji: "🚗", keywords: ["car", "automobile", "vehicle"] },
        { emoji: "🚕", keywords: ["taxi", "cab", "car"] },
        { emoji: "🚌", keywords: ["bus", "vehicle", "public"] },
        { emoji: "🚎", keywords: ["trolleybus", "bus", "vehicle"] },
        { emoji: "🏎️", keywords: ["racing", "car", "fast"] },
        { emoji: "🚓", keywords: ["police", "car", "cop"] },
        { emoji: "🚑", keywords: ["ambulance", "emergency", "medical"] },
        { emoji: "🚒", keywords: ["fire", "truck", "emergency"] },
        { emoji: "🚐", keywords: ["minibus", "van", "vehicle"] },
        { emoji: "🚚", keywords: ["truck", "delivery", "vehicle"] },
        { emoji: "🚛", keywords: ["truck", "semi", "lorry"] },
        { emoji: "🚲", keywords: ["bicycle", "bike", "cycling"] },
        { emoji: "🛵", keywords: ["scooter", "motor", "vespa"] },
        { emoji: "🏍️", keywords: ["motorcycle", "racing", "bike"] },
        { emoji: "✈️", keywords: ["airplane", "plane", "flight", "travel"] },
        { emoji: "🚀", keywords: ["rocket", "space", "launch"] },
        { emoji: "🛸", keywords: ["ufo", "flying", "saucer", "alien"] },
        { emoji: "🚁", keywords: ["helicopter", "chopper", "flight"] },
        { emoji: "🛶", keywords: ["canoe", "boat", "paddle"] },
        { emoji: "⛵", keywords: ["sailboat", "boat", "sailing"] },
        { emoji: "🚢", keywords: ["ship", "boat", "cruise"] },
        { emoji: "⚓", keywords: ["anchor", "ship", "boat"] },
        { emoji: "🏠", keywords: ["house", "home", "building"] },
        { emoji: "🏡", keywords: ["house", "garden", "home"] },
        { emoji: "🏢", keywords: ["office", "building", "work"] },
        { emoji: "🏣", keywords: ["post", "office", "japanese"] },
        { emoji: "🏥", keywords: ["hospital", "medical", "building"] },
        { emoji: "🏦", keywords: ["bank", "building", "money"] },
        { emoji: "🏨", keywords: ["hotel", "building", "travel"] },
        { emoji: "🏩", keywords: ["love", "hotel", "building"] },
        { emoji: "🏪", keywords: ["store", "convenience", "shop"] },
        { emoji: "🏫", keywords: ["school", "building", "education"] },
        { emoji: "🏬", keywords: ["department", "store", "mall"] },
        { emoji: "🏭", keywords: ["factory", "building", "industry"] },
        { emoji: "🏯", keywords: ["castle", "japanese", "building"] },
        { emoji: "🏰", keywords: ["castle", "european", "building"] },
        { emoji: "🗼", keywords: ["tower", "tokyo", "landmark"] },
        { emoji: "🗽", keywords: ["statue", "liberty", "new", "york"] },
        { emoji: "⛪", keywords: ["church", "building", "religion"] },
        { emoji: "🕌", keywords: ["mosque", "building", "islam"] },
        { emoji: "🌁", keywords: ["foggy", "bridge", "san", "francisco"] },
        { emoji: "🌃", keywords: ["night", "city", "stars"] },
        { emoji: "🌄", keywords: ["sunrise", "mountain", "morning"] },
        { emoji: "🌅", keywords: ["sunrise", "sun", "morning"] },
        { emoji: "🌆", keywords: ["cityscape", "dusk", "evening"] },
        { emoji: "🌇", keywords: ["sunset", "city", "evening"] },
        { emoji: "🌉", keywords: ["bridge", "night", "city"] },
      ],
    },
    objects: {
      name: "Objects",
      icon: "💡",
      emojis: [
        { emoji: "⌚", keywords: ["watch", "time", "clock"] },
        { emoji: "📱", keywords: ["phone", "mobile", "iphone", "smartphone"] },
        { emoji: "💻", keywords: ["laptop", "computer", "mac"] },
        { emoji: "⌨️", keywords: ["keyboard", "type", "computer"] },
        { emoji: "🖥️", keywords: ["desktop", "computer", "monitor"] },
        { emoji: "🖨️", keywords: ["printer", "paper", "print"] },
        { emoji: "🖱️", keywords: ["mouse", "computer", "click"] },
        { emoji: "💽", keywords: ["disk", "minidisk", "storage"] },
        { emoji: "💾", keywords: ["floppy", "disk", "save"] },
        { emoji: "💿", keywords: ["cd", "disk", "dvd"] },
        { emoji: "📀", keywords: ["dvd", "disk", "cd"] },
        { emoji: "📷", keywords: ["camera", "photo", "picture"] },
        { emoji: "📸", keywords: ["camera", "flash", "photo"] },
        { emoji: "📹", keywords: ["video", "camera", "record"] },
        { emoji: "🎥", keywords: ["movie", "camera", "film"] },
        { emoji: "📞", keywords: ["phone", "telephone", "call"] },
        { emoji: "☎️", keywords: ["phone", "telephone", "call"] },
        { emoji: "📺", keywords: ["tv", "television", "watch"] },
        { emoji: "📻", keywords: ["radio", "music", "broadcast"] },
        { emoji: "🎙️", keywords: ["microphone", "studio", "podcast"] },
        { emoji: "⏰", keywords: ["alarm", "clock", "time", "wake"] },
        { emoji: "⏱️", keywords: ["stopwatch", "timer", "time"] },
        { emoji: "⏲️", keywords: ["timer", "clock", "kitchen"] },
        { emoji: "🕰️", keywords: ["clock", "mantelpiece", "time"] },
        { emoji: "💡", keywords: ["lightbulb", "idea", "light"] },
        { emoji: "🔦", keywords: ["flashlight", "torch", "light"] },
        { emoji: "🕯️", keywords: ["candle", "light", "flame"] },
        { emoji: "💰", keywords: ["money", "bag", "dollar", "rich"] },
        { emoji: "💳", keywords: ["credit", "card", "pay", "money"] },
        { emoji: "💎", keywords: ["gem", "diamond", "jewel"] },
        { emoji: "🔧", keywords: ["wrench", "tool", "fix"] },
        { emoji: "🔨", keywords: ["hammer", "tool", "build"] },
        { emoji: "🔩", keywords: ["nut", "bolt", "tool"] },
        { emoji: "🔗", keywords: ["link", "chain", "url"] },
        { emoji: "📎", keywords: ["paperclip", "clip", "attach"] },
        { emoji: "✂️", keywords: ["scissors", "cut", "tool"] },
        { emoji: "📐", keywords: ["ruler", "triangle", "math"] },
        { emoji: "📏", keywords: ["ruler", "straight", "measure"] },
        { emoji: "📌", keywords: ["pushpin", "pin", "location"] },
        { emoji: "📍", keywords: ["pin", "location", "map"] },
        { emoji: "🔒", keywords: ["lock", "locked", "secure"] },
        { emoji: "🔓", keywords: ["unlock", "open", "lock"] },
        { emoji: "🔑", keywords: ["key", "lock", "password"] },
        { emoji: "🔐", keywords: ["lock", "key", "secure"] },
      ],
    },
    symbols: {
      name: "Symbols",
      icon: "❤️",
      emojis: [
        { emoji: "❤️", keywords: ["heart", "love", "red"] },
        { emoji: "🧡", keywords: ["heart", "orange", "love"] },
        { emoji: "💛", keywords: ["heart", "yellow", "love"] },
        { emoji: "💚", keywords: ["heart", "green", "love"] },
        { emoji: "💙", keywords: ["heart", "blue", "love"] },
        { emoji: "💜", keywords: ["heart", "purple", "love"] },
        { emoji: "🖤", keywords: ["heart", "black", "love"] },
        { emoji: "🤍", keywords: ["heart", "white", "love"] },
        { emoji: "🤎", keywords: ["heart", "brown", "love"] },
        { emoji: "💔", keywords: ["broken", "heart", "sad"] },
        { emoji: "❣️", keywords: ["heart", "exclamation", "love"] },
        { emoji: "💕", keywords: ["hearts", "two", "love"] },
        { emoji: "💞", keywords: ["hearts", "revolving", "love"] },
        { emoji: "💓", keywords: ["heart", "beating", "love"] },
        { emoji: "💗", keywords: ["heart", "growing", "love"] },
        { emoji: "💖", keywords: ["heart", "sparkle", "love"] },
        { emoji: "💘", keywords: ["heart", "arrow", "cupid", "love"] },
        { emoji: "💝", keywords: ["heart", "ribbon", "gift", "love"] },
        { emoji: "💟", keywords: ["heart", "decoration", "love"] },
        { emoji: "☮️", keywords: ["peace", "symbol", "sign"] },
        { emoji: "✝️", keywords: ["cross", "christian", "religion"] },
        { emoji: "☪️", keywords: ["star", "crescent", "islam"] },
        { emoji: "🕉️", keywords: ["om", "hindu", "religion"] },
        { emoji: "☯️", keywords: ["yin", "yang", "balance"] },
        { emoji: "✡️", keywords: ["star", "david", "jewish"] },
        { emoji: "🔯", keywords: ["star", "six", "pointed"] },
        { emoji: "♈", keywords: ["aries", "zodiac", "horoscope"] },
        { emoji: "♉", keywords: ["taurus", "zodiac", "horoscope"] },
        { emoji: "♊", keywords: ["gemini", "zodiac", "horoscope"] },
        { emoji: "♋", keywords: ["cancer", "zodiac", "horoscope"] },
        { emoji: "♌", keywords: ["leo", "zodiac", "horoscope"] },
        { emoji: "♍", keywords: ["virgo", "zodiac", "horoscope"] },
        { emoji: "♎", keywords: ["libra", "zodiac", "horoscope"] },
        { emoji: "♏", keywords: ["scorpio", "zodiac", "horoscope"] },
        { emoji: "♐", keywords: ["sagittarius", "zodiac", "horoscope"] },
        { emoji: "♑", keywords: ["capricorn", "zodiac", "horoscope"] },
        { emoji: "♒", keywords: ["aquarius", "zodiac", "horoscope"] },
        { emoji: "♓", keywords: ["pisces", "zodiac", "horoscope"] },
        { emoji: "⛎", keywords: ["ophiuchus", "zodiac", "horoscope"] },
        { emoji: "🆔", keywords: ["id", "identity", "button"] },
        { emoji: "⚛️", keywords: ["atom", "symbol", "science"] },
        { emoji: "🈳", keywords: ["vacancy", "japanese", "empty"] },
        { emoji: "🈵", keywords: ["full", "japanese", "no vacancy"] },
        { emoji: "🈲", keywords: ["prohibited", "japanese", "forbidden"] },
        { emoji: "🈹", keywords: ["discount", "japanese", "sale"] },
        { emoji: "🉐", keywords: ["bargain", "japanese", "deal"] },
        { emoji: "🈺", keywords: ["open", "japanese", "business"] },
        { emoji: "✴️", keywords: ["star", "eight", "pointed"] },
        { emoji: "🆚", keywords: ["vs", "versus", "against"] },
        { emoji: "🅰️", keywords: ["a", "blood", "letter"] },
        { emoji: "🅱️", keywords: ["b", "blood", "letter"] },
        { emoji: "🆎", keywords: ["ab", "blood", "type"] },
        { emoji: "🆑", keywords: ["cl", "clear", "button"] },
        { emoji: "🅾️", keywords: ["o", "blood", "letter"] },
        { emoji: "🆘", keywords: ["sos", "help", "emergency"] },
        { emoji: "❌", keywords: ["cross", "x", "no", "wrong"] },
        { emoji: "⭕", keywords: ["circle", "o", "ring"] },
        { emoji: "🛑", keywords: ["stop", "sign", "octagon"] },
        { emoji: "⛔", keywords: ["prohibited", "no", "entry"] },
        { emoji: "📛", keywords: ["name", "badge", "tag"] },
        { emoji: "🚫", keywords: ["prohibited", "no", "forbidden"] },
        { emoji: "💯", keywords: ["hundred", "100", "score", "perfect"] },
        { emoji: "💢", keywords: ["anger", "symbol", "mad"] },
        { emoji: "♨️", keywords: ["hot", "springs", "steam"] },
        { emoji: "🚷", keywords: ["no", "pedestrians", "forbidden"] },
        { emoji: "🚯", keywords: ["no", "littering", "forbidden"] },
        { emoji: "🚳", keywords: ["no", "bicycles", "forbidden"] },
        { emoji: "🚱", keywords: ["non", "potable", "water"] },
        { emoji: "🔞", keywords: ["18", "adult", "no", "minors"] },
        { emoji: "📵", keywords: ["no", "mobile", "phones"] },
        { emoji: "🔇", keywords: ["muted", "speaker", "sound", "off"] },
        { emoji: "🔕", keywords: ["bell", "slash", "silent", "mute"] },
        { emoji: "✅", keywords: ["check", "mark", "yes", "correct"] },
        { emoji: "✔️", keywords: ["check", "mark", "correct", "tick"] },
        { emoji: "☑️", keywords: ["check", "box", "ballot"] },
        { emoji: "➕", keywords: ["plus", "add", "math"] },
        { emoji: "➖", keywords: ["minus", "subtract", "math"] },
        { emoji: "➗", keywords: ["divide", "division", "math"] },
        { emoji: "✖️", keywords: ["multiply", "x", "math"] },
        { emoji: "♾️", keywords: ["infinity", "forever", "endless"] },
        { emoji: "❓", keywords: ["question", "mark", "punctuation"] },
        { emoji: "❔", keywords: ["question", "mark", "white"] },
        { emoji: "❕", keywords: ["exclamation", "mark", "white"] },
        { emoji: "❗", keywords: ["exclamation", "mark", "important"] },
        { emoji: "〰️", keywords: ["wavy", "dash", "line"] },
        { emoji: "💱", keywords: ["currency", "exchange", "money"] },
        { emoji: "💲", keywords: ["dollar", "money", "sign"] },
        { emoji: "⚕️", keywords: ["medical", "health", "staff"] },
        { emoji: "♻️", keywords: ["recycle", "symbol", "environment"] },
        { emoji: "⚜️", keywords: ["fleur", "de", "lis"] },
        { emoji: "🔱", keywords: ["trident", "emblem", "poseidon"] },
        { emoji: "📛", keywords: ["name", "badge", "tag"] },
        { emoji: "🔰", keywords: ["beginner", "symbol", "japanese"] },
        { emoji: "⭐", keywords: ["star", "favorite", "rating"] },
        { emoji: "🌟", keywords: ["star", "glowing", "sparkle"] },
        { emoji: "💫", keywords: ["dizzy", "star", "sparkle"] },
        { emoji: "✨", keywords: ["sparkles", "stars", "shine", "magic"] },
        { emoji: "⚡", keywords: ["lightning", "bolt", "zap", "electric"] },
        { emoji: "🔥", keywords: ["fire", "flame", "hot", "lit"] },
        { emoji: "💥", keywords: ["boom", "collision", "explosion"] },
        { emoji: "☄️", keywords: ["comet", "space", "meteor"] },
      ],
    },
    flags: {
      name: "Flags",
      icon: "🏳️",
      emojis: [
        { emoji: "🏳️", keywords: ["flag", "white", "surrender"] },
        { emoji: "🏴", keywords: ["flag", "black", "pirate"] },
        { emoji: "🏁", keywords: ["flag", "checkered", "race", "finish"] },
        { emoji: "🚩", keywords: ["flag", "red", "triangular"] },
        { emoji: "🏳️‍🌈", keywords: ["flag", "rainbow", "pride", "lgbtq"] },
        { emoji: "🏳️‍⚧️", keywords: ["flag", "transgender", "pride"] },
        { emoji: "🏴‍☠️", keywords: ["flag", "pirate", "jolly", "roger"] },
        { emoji: "🇺🇸", keywords: ["flag", "us", "usa", "america", "united", "states"] },
        { emoji: "🇬🇧", keywords: ["flag", "uk", "britain", "england", "united", "kingdom"] },
        { emoji: "🇯🇵", keywords: ["flag", "japan", "japanese"] },
        { emoji: "🇰🇷", keywords: ["flag", "korea", "korean", "south"] },
        { emoji: "🇨🇳", keywords: ["flag", "china", "chinese"] },
        { emoji: "🇫🇷", keywords: ["flag", "france", "french"] },
        { emoji: "🇩🇪", keywords: ["flag", "germany", "german"] },
        { emoji: "🇮🇹", keywords: ["flag", "italy", "italian"] },
        { emoji: "🇪🇸", keywords: ["flag", "spain", "spanish"] },
        { emoji: "🇧🇷", keywords: ["flag", "brazil", "brazilian"] },
        { emoji: "🇷🇺", keywords: ["flag", "russia", "russian"] },
        { emoji: "🇮🇳", keywords: ["flag", "india", "indian"] },
        { emoji: "🇦🇺", keywords: ["flag", "australia", "australian"] },
        { emoji: "🇨🇦", keywords: ["flag", "canada", "canadian"] },
        { emoji: "🇲🇽", keywords: ["flag", "mexico", "mexican"] },
        { emoji: "🇳🇱", keywords: ["flag", "netherlands", "dutch"] },
        { emoji: "🇸🇪", keywords: ["flag", "sweden", "swedish"] },
        { emoji: "🇨🇭", keywords: ["flag", "switzerland", "swiss"] },
        { emoji: "🇳🇴", keywords: ["flag", "norway", "norwegian"] },
        { emoji: "🇩🇰", keywords: ["flag", "denmark", "danish"] },
        { emoji: "🇵🇱", keywords: ["flag", "poland", "polish"] },
        { emoji: "🇺🇦", keywords: ["flag", "ukraine", "ukrainian"] },
        { emoji: "🇸🇦", keywords: ["flag", "saudi", "arabia"] },
        { emoji: "🇿🇦", keywords: ["flag", "south", "africa"] },
      ],
    },
  };

// Recent emoji storage
const RECENT_EMOJIS_KEY = "kloak-recent-emojis";
const MAX_RECENT_EMOJIS = 24;

const getRecentEmojis = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
};

const saveRecentEmoji = (emoji: string) => {
  try {
    const recent = getRecentEmojis();
    const filtered = recent.filter((e) => e !== emoji);
    const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
};

export const EmojiPicker = ({ children, onEmojiSelect, open, onOpenChange, serverId }: EmojiPickerProps) => {
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
    [onEmojiSelect, onOpenChange, selectedServerForEmoji, servers],
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

    // Search through all native categories
    Object.values(EMOJI_DATA).forEach((category) => {
      if (category.emojis) {
        category.emojis.forEach((emojiData) => {
          if (emojiData.keywords.some((keyword) => keyword.includes(trimmedSearch))) {
            results.push({ type: "native", emoji: emojiData.emoji });
          }
        });
      }
    });

    // Search through custom emojis from all loaded servers
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

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[320px] sm:w-[380px] p-0 bg-card border-border/50 rounded-2xl shadow-2xl overflow-hidden"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emoji..."
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
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
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
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </div>
        )}

        {/* Emoji Grid */}
        <ScrollArea className="h-[220px] sm:h-[280px]">
          <div className="p-2 sm:p-3">
            {search.trim() ? (
              // Search results
              filteredEmojis && filteredEmojis.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Results for "{search.trim()}"
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-0.5">
                    {filteredEmojis.map((item, i) =>
                      item.type === "native" ? (
                        <button
                          key={`search-native-${item.emoji}-${i}`}
                          type="button"
                          className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
                          onClick={() => handleSelect(item.emoji)}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <FluentEmoji emoji={item.emoji} size={28} />
                        </button>
                      ) : (
                        <button
                          key={`search-custom-${item.emoji.id}`}
                          type="button"
                          className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
                          onClick={() => handleCustomEmojiSelect(item.emoji)}
                          onMouseDown={(e) => e.preventDefault()}
                          title={`:${item.emoji.name}:`}
                        >
                          <img
                            src={item.emoji.url}
                            alt={item.emoji.name}
                            className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                          />
                        </button>
                      ),
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No emoji found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try "happy", "love", or "fire"</p>
                </div>
              )
            ) : selectedServerForEmoji ? (
              // Custom server emoji view
              <div>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {servers.find((s) => s.id === selectedServerForEmoji)?.name || "Server"} Emojis
                  </span>
                </div>
                {loadingServers.has(selectedServerForEmoji) ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-3" />
                    <p className="text-sm text-muted-foreground">Loading emojis...</p>
                  </div>
                ) : currentServerEmojis.length > 0 ? (
                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-0.5">
                    {currentServerEmojis.map((emoji) => (
                      <button
                        key={emoji.id}
                        type="button"
                        className="aspect-square hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150 p-1"
                        onClick={() => handleCustomEmojiSelect(emoji)}
                        onMouseDown={(e) => e.preventDefault()}
                        title={`:${emoji.name}:`}
                      >
                        <img src={emoji.url} alt={emoji.name} className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
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
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-0.5">
                          {cat.emojis.map((emoji, i) => {
                            // Check if this is a custom emoji (format: :name:)
                            const isCustomEmoji = cat.key === "recent" && emoji.startsWith(":") && emoji.endsWith(":") && emoji.length > 2;
                            
                            if (isCustomEmoji) {
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
                                      className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
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
                                <FluentEmoji emoji={emoji} size={28} />
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
              {servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => {
                    setSelectedServerForEmoji(server.id);
                    setActiveCategory(""); // Deselect native category
                  }}
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-lg transition-all duration-200",
                    selectedServerForEmoji === server.id
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-card"
                      : "hover:opacity-80",
                  )}
                  title={server.name}
                >
                  <Avatar className="w-full h-full rounded-lg">
                    {server.icon_url ? (
                      <AvatarImage src={server.icon_url} alt={server.name} className="object-cover" />
                    ) : null}
                    <AvatarFallback className="rounded-lg bg-muted text-xs font-medium">
                      {server.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
