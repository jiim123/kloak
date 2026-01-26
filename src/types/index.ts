/**
 * Type definitions for Kloak
 * All data models used throughout the application
 */

// ============================================
// User Types
// ============================================

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  avatar_decoration: string | null;
  profile_effect: string | null;
  banner_color: string;
  profile_theme_primary: string | null;
  profile_theme_accent: string | null;
  bio: string | null;
  status: UserStatus;
  custom_status: string | null;
  created_at: string;
  last_seen: string | null;
}

export interface UserProfile extends User {
  mutual_servers?: number;
  mutual_friends?: number;
  is_friend?: boolean;
  friendship_status?: FriendshipStatus | null;
}

// ============================================
// Server Types
// ============================================

export type ServerRole = 'owner' | 'admin' | 'moderator' | 'member';

export interface CustomServerRole {
  id: string;
  server_id: string;
  name: string;
  color: string;
  icon?: string | null;
  position: number;
  created_at: string;
}

export type Permission = 
  | 'manage_server'
  | 'manage_roles'
  | 'manage_channels'
  | 'manage_emojis'
  | 'kick_members'
  | 'ban_members'
  | 'mute_members'
  | 'manage_nicknames'
  | 'manage_messages'
  | 'pin_messages'
  | 'send_messages'
  | 'add_reactions'
  | 'view_channels'
  | 'transfer_ownership'
  | 'manage_invites';

export interface RolePermission {
  id: string;
  server_id: string;
  role_id: string | null;
  role_name: ServerRole | null;
  permission: Permission;
  allowed: boolean;
  created_at: string;
}

export interface ChannelPermission {
  id: string;
  channel_id: string;
  role_id: string | null;
  role_name: ServerRole | null;
  permission: Permission;
  allowed: boolean;
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  banner_url: string | null;
  is_published: boolean;
  about: string | null;
  owner_id: string;
  invite_code: string;
  created_at: string;
  system_channel_join_id?: string | null;
  system_channel_leave_id?: string | null;
  enable_join_messages?: boolean;
  enable_leave_messages?: boolean;
}

export interface ServerWithMembership extends Server {
  role: ServerRole;
  nickname: string | null;
  joined_at: string;
  unread_count?: number;
  mention_count?: number;
}

export interface ServerMember {
  id: string;
  server_id: string;
  user_id: string;
  role: ServerRole;
  nickname: string | null;
  is_banned: boolean;
  is_muted: boolean;
  joined_at: string;
  user?: User;
  roles?: CustomServerRole[];
}

// ============================================
// Channel Types
// ============================================

export type ChannelType = 'text' | 'voice' | 'announcement';

export interface ChannelCategory {
  id: string;
  server_id: string;
  name: string;
  position: number;
  is_collapsed: boolean;
  created_at: string;
  channels?: Channel[];
}

export interface Channel {
  id: string;
  server_id: string;
  category_id: string | null;
  name: string;
  topic: string | null;
  type: ChannelType;
  position: number;
  is_nsfw: boolean;
  slowmode_seconds: number;
  is_read_only: boolean;
  is_private: boolean;
  icon: string | null;
  created_at: string;
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  added_by: string | null;
  created_at: string;
  user?: User;
}

export interface ChannelWithUnread extends Channel {
  unread_count?: number;
  mention_count?: number;
  last_message_at?: string;
}

export interface ChannelRead {
  id: string;
  channel_id: string;
  user_id: string;
  last_read_message_id: string | null;
  last_read_at: string | null;
  mention_count: number;
}

// ============================================
// Message Types
// ============================================

export interface Poll {
  id: string;
  message_id: string;
  channel_id: string;
  created_by: string;
  question: string;
  options: string[];
  allow_multiple: boolean;
  ends_at: string;
  is_closed: boolean;
  results: number[]; // counts aligned with options[]
  total_votes: number;
  created_at: string;
}

export interface MessageReply {
  id: string;
  content: string;
  user?: User;
}

export interface Message {
  id: string;
  channel_id: string;
  user_id: string;
  reply_to_id: string | null;
  content: string;
  is_pinned: boolean;
  is_system_message?: boolean;
  edited_at: string | null;
  created_at: string;
  user?: User;
  attachments?: MessageAttachment[];
  reactions?: ReactionGroup[];
  reply_to?: MessageReply;
  mentions?: Mention[];
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[]; // user IDs
  hasReacted: boolean; // current user has reacted
}

export type MentionType = 'user' | 'everyone' | 'here' | 'role';

export interface Mention {
  id: string;
  message_id: string;
  user_id: string;
  mention_type: MentionType;
}

// ============================================
// Direct Message Types
// ============================================

export interface DMConversation {
  id: string;
  created_at: string;
  participants?: DMParticipant[];
  last_message?: DirectMessage;
  other_user?: User;
  unread_count?: number;
}

export interface DMParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string | null;
  user?: User;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  reply_to_id: string | null;
  content: string;
  edited_at: string | null;
  created_at: string;
  sender?: User;
  attachments?: DMAttachment[];
  reactions?: ReactionGroup[];
  reply_to?: DirectMessage;
}

export interface DMAttachment {
  id: string;
  message_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
}

export interface DMReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

// ============================================
// Friendship Types
// ============================================

export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  requester?: User;
  addressee?: User;
}

export interface FriendWithUser extends User {
  friendship_id: string;
  friendship_status: FriendshipStatus;
  is_requester: boolean;
}

// ============================================
// Notification Types
// ============================================

export type NotificationType = 'mention' | 'dm' | 'friend_request' | 'server_invite';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ============================================
// Real-time State Types
// ============================================

export interface TypingUser {
  user_id: string;
  username: string;
  display_name: string | null;
  started_at: number;
}

export interface PresenceState {
  user_id: string;
  status: UserStatus;
  last_seen: string;
}

// ============================================
// Emoji Types
// ============================================

export interface EmojiData {
  id: string;
  name: string;
  native: string;
  unified: string;
  keywords: string[];
  shortcodes: string;
}

export interface EmojiCategory {
  id: string;
  name: string;
  emojis: EmojiData[];
}

export interface CustomEmoji {
  id: string;
  server_id: string;
  name: string;
  image_url: string;
  uploaded_by: string;
  created_at: string;
}

// ============================================
// UI State Types
// ============================================

export interface MessageGroup {
  user: User;
  messages: Message[];
  date: string;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface ModalState {
  isOpen: boolean;
  type: string | null;
  data?: unknown;
}

// ============================================
// Search Types
// ============================================

export interface SearchResult {
  message_id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  rank: number;
  channel?: Channel;
  user?: User;
  server?: Server;
}

export interface SearchFilters {
  query: string;
  server_id?: string;
  channel_id?: string;
  user_id?: string;
  has_attachment?: boolean;
  before?: string;
  after?: string;
}

// ============================================
// Form Types
// ============================================

export interface CreateServerForm {
  name: string;
  icon?: File;
}

export interface CreateChannelForm {
  name: string;
  type: ChannelType;
  category_id?: string;
  topic?: string;
  is_nsfw?: boolean;
}

export interface UpdateProfileForm {
  display_name?: string;
  bio?: string;
  banner_color?: string;
  avatar?: File;
}

export interface SendMessageForm {
  content: string;
  attachments?: File[];
  reply_to_id?: string;
}
