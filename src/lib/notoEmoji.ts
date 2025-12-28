/**
 * Noto Emoji icons for channel selection
 * Using standard Noto Emoji (not Color) for consistent rendering
 */

export interface NotoEmoji {
  char: string;
  name: string;
  category: string;
}

// Common emoji icons suitable for channels - using text emoji style
export const channelEmojis: NotoEmoji[] = [
  // Communication
  { char: '💬', name: 'Speech Bubble', category: 'Communication' },
  { char: '📢', name: 'Loudspeaker', category: 'Communication' },
  { char: '📣', name: 'Megaphone', category: 'Communication' },
  { char: '🗨️', name: 'Left Speech Bubble', category: 'Communication' },
  { char: '💭', name: 'Thought Bubble', category: 'Communication' },
  
  // Objects
  { char: '📝', name: 'Memo', category: 'Objects' },
  { char: '📚', name: 'Books', category: 'Objects' },
  { char: '📖', name: 'Open Book', category: 'Objects' },
  { char: '📁', name: 'Folder', category: 'Objects' },
  { char: '📂', name: 'Open Folder', category: 'Objects' },
  { char: '🗂️', name: 'Card Index', category: 'Objects' },
  { char: '📋', name: 'Clipboard', category: 'Objects' },
  { char: '📌', name: 'Pushpin', category: 'Objects' },
  { char: '📎', name: 'Paperclip', category: 'Objects' },
  { char: '🔗', name: 'Link', category: 'Objects' },
  { char: '🔒', name: 'Lock', category: 'Objects' },
  { char: '🔓', name: 'Unlock', category: 'Objects' },
  { char: '🔑', name: 'Key', category: 'Objects' },
  { char: '🔔', name: 'Bell', category: 'Objects' },
  { char: '🔕', name: 'Bell Silent', category: 'Objects' },
  
  // Tech & Gaming
  { char: '💻', name: 'Laptop', category: 'Tech' },
  { char: '🖥️', name: 'Desktop', category: 'Tech' },
  { char: '🎮', name: 'Game Controller', category: 'Tech' },
  { char: '🎲', name: 'Dice', category: 'Tech' },
  { char: '🎯', name: 'Target', category: 'Tech' },
  { char: '🎨', name: 'Art Palette', category: 'Tech' },
  { char: '🎵', name: 'Music Note', category: 'Tech' },
  { char: '🎬', name: 'Clapper Board', category: 'Tech' },
  { char: '📷', name: 'Camera', category: 'Tech' },
  { char: '📹', name: 'Video Camera', category: 'Tech' },
  { char: '🎤', name: 'Microphone', category: 'Tech' },
  { char: '🎧', name: 'Headphones', category: 'Tech' },
  { char: '📡', name: 'Satellite', category: 'Tech' },
  
  // Nature & Weather
  { char: '🌟', name: 'Glowing Star', category: 'Nature' },
  { char: '⭐', name: 'Star', category: 'Nature' },
  { char: '✨', name: 'Sparkles', category: 'Nature' },
  { char: '🌙', name: 'Moon', category: 'Nature' },
  { char: '☀️', name: 'Sun', category: 'Nature' },
  { char: '🌈', name: 'Rainbow', category: 'Nature' },
  { char: '⚡', name: 'Lightning', category: 'Nature' },
  { char: '🔥', name: 'Fire', category: 'Nature' },
  { char: '💧', name: 'Water Drop', category: 'Nature' },
  { char: '🌊', name: 'Wave', category: 'Nature' },
  { char: '🌸', name: 'Cherry Blossom', category: 'Nature' },
  { char: '🌺', name: 'Hibiscus', category: 'Nature' },
  { char: '🌻', name: 'Sunflower', category: 'Nature' },
  { char: '🍀', name: 'Four Leaf Clover', category: 'Nature' },
  
  // Symbols
  { char: '❤️', name: 'Red Heart', category: 'Symbols' },
  { char: '💜', name: 'Purple Heart', category: 'Symbols' },
  { char: '💙', name: 'Blue Heart', category: 'Symbols' },
  { char: '💚', name: 'Green Heart', category: 'Symbols' },
  { char: '💛', name: 'Yellow Heart', category: 'Symbols' },
  { char: '🧡', name: 'Orange Heart', category: 'Symbols' },
  { char: '✅', name: 'Check Mark', category: 'Symbols' },
  { char: '❌', name: 'Cross Mark', category: 'Symbols' },
  { char: '⚠️', name: 'Warning', category: 'Symbols' },
  { char: '💡', name: 'Light Bulb', category: 'Symbols' },
  { char: '❓', name: 'Question Mark', category: 'Symbols' },
  { char: '❗', name: 'Exclamation Mark', category: 'Symbols' },
  { char: '🏆', name: 'Trophy', category: 'Symbols' },
  { char: '🎖️', name: 'Medal', category: 'Symbols' },
  { char: '👑', name: 'Crown', category: 'Symbols' },
  
  // Faces & People
  { char: '😊', name: 'Smiling Face', category: 'Faces' },
  { char: '🤝', name: 'Handshake', category: 'Faces' },
  { char: '👥', name: 'People', category: 'Faces' },
  { char: '👤', name: 'Person', category: 'Faces' },
  { char: '🤖', name: 'Robot', category: 'Faces' },
  { char: '👾', name: 'Alien Monster', category: 'Faces' },
  { char: '🦊', name: 'Fox', category: 'Faces' },
  { char: '🐱', name: 'Cat', category: 'Faces' },
  { char: '🐶', name: 'Dog', category: 'Faces' },
  { char: '🦁', name: 'Lion', category: 'Faces' },
  
  // Places & Travel
  { char: '🏠', name: 'House', category: 'Places' },
  { char: '🏢', name: 'Office Building', category: 'Places' },
  { char: '🏰', name: 'Castle', category: 'Places' },
  { char: '🌍', name: 'Globe', category: 'Places' },
  { char: '🚀', name: 'Rocket', category: 'Places' },
  { char: '✈️', name: 'Airplane', category: 'Places' },
  { char: '🛸', name: 'UFO', category: 'Places' },
  
  // Food & Drinks
  { char: '☕', name: 'Coffee', category: 'Food' },
  { char: '🍕', name: 'Pizza', category: 'Food' },
  { char: '🎂', name: 'Birthday Cake', category: 'Food' },
  { char: '🍿', name: 'Popcorn', category: 'Food' },
];

export const emojiCategories = [
  'Communication',
  'Objects', 
  'Tech',
  'Nature',
  'Symbols',
  'Faces',
  'Places',
  'Food'
] as const;

export type EmojiCategory = typeof emojiCategories[number];

export const getEmojisByCategory = (category: EmojiCategory): NotoEmoji[] => {
  return channelEmojis.filter(e => e.category === category);
};