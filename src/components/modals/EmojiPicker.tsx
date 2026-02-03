import { useState, useMemo, useRef, useEffect, useCallback } from "react";
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
        { emoji: "🌭", keywords: ["hotdog", "sausage", "fast", "food"] },
        { emoji: "🥪", keywords: ["sandwich", "bread", "lunch"] },
        { emoji: "🌮", keywords: ["taco", "mexican", "food"] },
        { emoji: "🌯", keywords: ["burrito", "mexican", "food", "wrap"] },
        { emoji: "🍝", keywords: ["spaghetti", "pasta", "italian"] },
        { emoji: "🍜", keywords: ["noodles", "ramen", "soup", "asian"] },
        { emoji: "🍣", keywords: ["sushi", "japanese", "fish"] },
        { emoji: "🍱", keywords: ["bento", "box", "japanese", "lunch"] },
        { emoji: "🍦", keywords: ["ice", "cream", "dessert", "soft", "serve"] },
        { emoji: "🍧", keywords: ["shaved", "ice", "dessert"] },
        { emoji: "🍨", keywords: ["ice", "cream", "dessert"] },
        { emoji: "🍩", keywords: ["donut", "doughnut", "dessert"] },
        { emoji: "🍪", keywords: ["cookie", "dessert", "sweet"] },
        { emoji: "🎂", keywords: ["cake", "birthday", "dessert"] },
        { emoji: "🍰", keywords: ["cake", "slice", "dessert", "shortcake"] },
        { emoji: "🧁", keywords: ["cupcake", "dessert", "sweet"] },
        { emoji: "🍫", keywords: ["chocolate", "candy", "sweet"] },
        { emoji: "🍬", keywords: ["candy", "sweet"] },
        { emoji: "🍭", keywords: ["lollipop", "candy", "sweet"] },
        { emoji: "🍿", keywords: ["popcorn", "movie", "snack"] },
        { emoji: "☕", keywords: ["coffee", "hot", "drink", "cafe"] },
        { emoji: "🍵", keywords: ["tea", "hot", "drink", "green"] },
        { emoji: "🥤", keywords: ["cup", "straw", "drink", "soda"] },
        { emoji: "🧋", keywords: ["bubble", "tea", "boba", "drink"] },
        { emoji: "🍺", keywords: ["beer", "mug", "drink", "alcohol"] },
        { emoji: "🍻", keywords: ["beer", "cheers", "drink", "alcohol"] },
        { emoji: "🍷", keywords: ["wine", "glass", "drink", "alcohol"] },
        { emoji: "🥂", keywords: ["champagne", "cheers", "celebrate"] },
        { emoji: "🍸", keywords: ["cocktail", "martini", "drink", "alcohol"] },
      ],
    },
    activities: {
      name: "Activities",
      icon: "⚽",
      emojis: [
        { emoji: "⚽", keywords: ["soccer", "football", "ball", "sport"] },
        { emoji: "🏀", keywords: ["basketball", "ball", "sport"] },
        { emoji: "🏈", keywords: ["football", "american", "ball", "sport"] },
        { emoji: "⚾", keywords: ["baseball", "ball", "sport"] },
        { emoji: "🎾", keywords: ["tennis", "ball", "sport"] },
        { emoji: "🏐", keywords: ["volleyball", "ball", "sport"] },
        { emoji: "🎱", keywords: ["pool", "billiards", "8ball"] },
        { emoji: "🏓", keywords: ["ping", "pong", "table", "tennis"] },
        { emoji: "🏸", keywords: ["badminton", "sport"] },
        { emoji: "🥊", keywords: ["boxing", "glove", "sport", "fight"] },
        { emoji: "🏆", keywords: ["trophy", "winner", "award", "champion"] },
        { emoji: "🥇", keywords: ["gold", "medal", "first", "winner"] },
        { emoji: "🥈", keywords: ["silver", "medal", "second"] },
        { emoji: "🥉", keywords: ["bronze", "medal", "third"] },
        { emoji: "🎮", keywords: ["video", "game", "controller", "gaming"] },
        { emoji: "🎲", keywords: ["dice", "game", "gambling"] },
        { emoji: "🎯", keywords: ["target", "dart", "bullseye"] },
        { emoji: "🎳", keywords: ["bowling", "sport", "pin"] },
        { emoji: "🎸", keywords: ["guitar", "music", "rock"] },
        { emoji: "🎹", keywords: ["piano", "keyboard", "music"] },
        { emoji: "🎺", keywords: ["trumpet", "music", "brass"] },
        { emoji: "🎷", keywords: ["saxophone", "music", "jazz"] },
        { emoji: "🥁", keywords: ["drum", "music", "beat"] },
        { emoji: "🎤", keywords: ["microphone", "karaoke", "sing", "music"] },
        { emoji: "🎧", keywords: ["headphones", "music", "listen"] },
        { emoji: "🎬", keywords: ["clapper", "movie", "film", "action"] },
        { emoji: "🎨", keywords: ["art", "palette", "paint", "draw"] },
        { emoji: "🎭", keywords: ["theater", "drama", "masks", "acting"] },
        { emoji: "🎪", keywords: ["circus", "tent", "carnival"] },
        { emoji: "🎰", keywords: ["slot", "machine", "casino", "gambling"] },
      ],
    },
    objects: {
      name: "Objects",
      icon: "💡",
      emojis: [
        { emoji: "💡", keywords: ["lightbulb", "idea", "light"] },
        { emoji: "🔦", keywords: ["flashlight", "torch", "light"] },
        { emoji: "📱", keywords: ["phone", "mobile", "smartphone", "iphone"] },
        { emoji: "💻", keywords: ["laptop", "computer", "mac"] },
        { emoji: "🖥️", keywords: ["desktop", "computer", "screen"] },
        { emoji: "⌨️", keywords: ["keyboard", "type", "computer"] },
        { emoji: "🖱️", keywords: ["mouse", "computer", "click"] },
        { emoji: "💾", keywords: ["floppy", "disk", "save"] },
        { emoji: "💿", keywords: ["cd", "disc", "dvd"] },
        { emoji: "📷", keywords: ["camera", "photo", "picture"] },
        { emoji: "📹", keywords: ["video", "camera", "record"] },
        { emoji: "📺", keywords: ["tv", "television", "watch"] },
        { emoji: "🔍", keywords: ["magnifying", "glass", "search", "zoom"] },
        { emoji: "💰", keywords: ["money", "bag", "dollar", "rich"] },
        { emoji: "💵", keywords: ["money", "dollar", "bill", "cash"] },
        { emoji: "💳", keywords: ["credit", "card", "payment"] },
        { emoji: "💎", keywords: ["gem", "diamond", "jewel"] },
        { emoji: "🔧", keywords: ["wrench", "tool", "fix"] },
        { emoji: "🔨", keywords: ["hammer", "tool", "build"] },
        { emoji: "🔩", keywords: ["nut", "bolt", "screw", "tool"] },
        { emoji: "⚙️", keywords: ["gear", "settings", "cog"] },
        { emoji: "🔑", keywords: ["key", "lock", "password"] },
        { emoji: "🔒", keywords: ["lock", "secure", "closed"] },
        { emoji: "🔓", keywords: ["unlock", "open", "unlocked"] },
        { emoji: "📧", keywords: ["email", "mail", "envelope"] },
        { emoji: "📦", keywords: ["package", "box", "delivery"] },
        { emoji: "📚", keywords: ["books", "library", "read", "study"] },
        { emoji: "📖", keywords: ["book", "read", "open"] },
        { emoji: "📝", keywords: ["memo", "note", "write", "pencil"] },
        { emoji: "✏️", keywords: ["pencil", "write", "draw"] },
        { emoji: "✂️", keywords: ["scissors", "cut"] },
        { emoji: "📌", keywords: ["pin", "pushpin", "location"] },
        { emoji: "📎", keywords: ["paperclip", "attachment"] },
        { emoji: "🗑️", keywords: ["trash", "garbage", "delete", "bin"] },
      ],
    },
    symbols: {
      name: "Symbols",
      icon: "❤️",
      emojis: [
        { emoji: "❤️", keywords: ["heart", "love", "red"] },
        { emoji: "🧡", keywords: ["heart", "love", "orange"] },
        { emoji: "💛", keywords: ["heart", "love", "yellow"] },
        { emoji: "💚", keywords: ["heart", "love", "green"] },
        { emoji: "💙", keywords: ["heart", "love", "blue"] },
        { emoji: "💜", keywords: ["heart", "love", "purple"] },
        { emoji: "🖤", keywords: ["heart", "love", "black"] },
        { emoji: "🤍", keywords: ["heart", "love", "white"] },
        { emoji: "💔", keywords: ["heart", "broken", "sad"] },
        { emoji: "❣️", keywords: ["heart", "exclamation", "love"] },
        { emoji: "💕", keywords: ["hearts", "love", "two"] },
        { emoji: "💗", keywords: ["heart", "growing", "love"] },
        { emoji: "💖", keywords: ["heart", "sparkling", "love"] },
        { emoji: "💘", keywords: ["heart", "arrow", "cupid", "love"] },
        { emoji: "💝", keywords: ["heart", "ribbon", "gift", "love"] },
        { emoji: "✅", keywords: ["check", "yes", "done", "correct"] },
        { emoji: "❌", keywords: ["x", "no", "wrong", "cross", "delete"] },
        { emoji: "❓", keywords: ["question", "mark", "help"] },
        { emoji: "❗", keywords: ["exclamation", "mark", "important"] },
        { emoji: "💯", keywords: ["hundred", "score", "perfect"] },
        { emoji: "🔥", keywords: ["fire", "hot", "lit", "flame"] },
        { emoji: "⭐", keywords: ["star", "favorite", "rating"] },
        { emoji: "✨", keywords: ["sparkles", "stars", "magic", "shine"] },
        { emoji: "💫", keywords: ["dizzy", "star", "sparkle"] },
        { emoji: "🌟", keywords: ["star", "glowing", "bright"] },
        { emoji: "⚡", keywords: ["lightning", "bolt", "electric", "zap"] },
        { emoji: "💥", keywords: ["boom", "collision", "explosion"] },
        { emoji: "💢", keywords: ["anger", "symbol", "angry"] },
        { emoji: "💤", keywords: ["zzz", "sleep", "tired"] },
        { emoji: "💬", keywords: ["speech", "bubble", "comment", "chat"] },
        { emoji: "💭", keywords: ["thought", "bubble", "thinking"] },
        { emoji: "🔔", keywords: ["bell", "notification", "alert"] },
        { emoji: "🔕", keywords: ["bell", "mute", "silent", "no sound"] },
        { emoji: "🎵", keywords: ["music", "note", "song"] },
        { emoji: "🎶", keywords: ["music", "notes", "song"] },
        { emoji: "➕", keywords: ["plus", "add", "more"] },
        { emoji: "➖", keywords: ["minus", "subtract", "less"] },
        { emoji: "➗", keywords: ["divide", "division"] },
        { emoji: "✖️", keywords: ["multiply", "x", "times"] },
        { emoji: "♻️", keywords: ["recycle", "environment", "green"] },
        { emoji: "⚠️", keywords: ["warning", "caution", "alert"] },
        { emoji: "🚫", keywords: ["prohibited", "no", "forbidden", "banned"] },
        { emoji: "🔞", keywords: ["no", "minors", "adult", "18+"] },
      ],
    },
    flags: {
      name: "Flags",
      icon: "🏳️",
      emojis: [
        { emoji: "🏳️", keywords: ["flag", "white", "surrender"] },
        { emoji: "🏴", keywords: ["flag", "black"] },
        { emoji: "🏴‍☠️", keywords: ["pirate", "flag", "skull"] },
        { emoji: "🏁", keywords: ["checkered", "flag", "racing", "finish"] },
        { emoji: "🚩", keywords: ["flag", "red", "triangular"] },
        { emoji: "🏳️‍🌈", keywords: ["rainbow", "flag", "pride", "lgbt", "gay"] },
        { emoji: "🏳️‍⚧️", keywords: ["transgender", "flag", "pride", "trans"] },
        { emoji: "🇺🇸", keywords: ["usa", "america", "flag", "united", "states"] },
        { emoji: "🇬🇧", keywords: ["uk", "britain", "flag", "england"] },
        { emoji: "🇨🇦", keywords: ["canada", "flag"] },
        { emoji: "🇦🇺", keywords: ["australia", "flag"] },
        { emoji: "🇩🇪", keywords: ["germany", "flag", "german"] },
        { emoji: "🇫🇷", keywords: ["france", "flag", "french"] },
        { emoji: "🇪🇸", keywords: ["spain", "flag", "spanish"] },
        { emoji: "🇮🇹", keywords: ["italy", "flag", "italian"] },
        { emoji: "🇯🇵", keywords: ["japan", "flag", "japanese"] },
        { emoji: "🇰🇷", keywords: ["korea", "flag", "korean", "south"] },
        { emoji: "🇨🇳", keywords: ["china", "flag", "chinese"] },
        { emoji: "🇮🇳", keywords: ["india", "flag", "indian"] },
        { emoji: "🇧🇷", keywords: ["brazil", "flag", "brazilian"] },
        { emoji: "🇲🇽", keywords: ["mexico", "flag", "mexican"] },
        { emoji: "🇷🇺", keywords: ["russia", "flag", "russian"] },
        { emoji: "🇺🇦", keywords: ["ukraine", "flag", "ukrainian"] },
        { emoji: "🇸🇪", keywords: ["sweden", "flag", "swedish"] },
        { emoji: "🇳🇴", keywords: ["norway", "flag", "norwegian"] },
        { emoji: "🇳🇱", keywords: ["netherlands", "flag", "dutch"] },
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

  // Refresh recent emojis when picker opens
  const recentEmojis = useMemo(() => {
    if (open) {
      return getRecentEmojis();
    }
    return [];
  }, [open]);

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

  // Filter emojis based on search - ACTUALLY FILTERS NOW
  const filteredEmojis = useMemo(() => {
    const trimmedSearch = search.trim().toLowerCase();
    if (!trimmedSearch) return null;

    const results: string[] = [];

    // Search through all categories
    Object.values(EMOJI_DATA).forEach((category) => {
      if (category.emojis) {
        category.emojis.forEach((emojiData) => {
          // Check if any keyword matches the search
          if (emojiData.keywords.some((keyword) => keyword.includes(trimmedSearch))) {
            results.push(emojiData.emoji);
          }
        });
      }
    });

    // Remove duplicates and limit results
    return [...new Set(results)].slice(0, 50);
  }, [search]);

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
                  onClick={() => setActiveCategory(cat.key)}
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
                    <span className="text-xl leading-none">{cat.icon}</span>
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
        <ScrollArea className="h-[280px] sm:h-[340px]">
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
                    {filteredEmojis.map((emoji, i) => (
                      <button
                        key={`search-${emoji}-${i}`}
                        type="button"
                        className="aspect-square text-[28px] sm:text-[32px] hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150"
                        onClick={() => handleSelect(emoji)}
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {emoji}
                      </button>
                    ))}
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
                          <span className="text-base">{cat.icon}</span>
                        )}
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {cat.name}
                        </span>
                      </div>

                      {cat.emojis.length > 0 ? (
                        <div className="grid grid-cols-5 sm:grid-cols-6 gap-0.5">
                          {cat.emojis.map((emoji, i) => (
                            <button
                              key={`${cat.key}-${emoji}-${i}`}
                              type="button"
                              className="aspect-square text-[28px] sm:text-[32px] hover:bg-muted/50 active:scale-90 rounded-lg flex items-center justify-center transition-all duration-150"
                              onClick={() => handleSelect(emoji)}
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {emoji}
                            </button>
                          ))}
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
      </PopoverContent>
    </Popover>
  );
};
