export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      channel_categories: {
        Row: {
          created_at: string | null
          id: string
          is_collapsed: boolean | null
          name: string
          position: number | null
          server_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_collapsed?: boolean | null
          name: string
          position?: number | null
          server_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_collapsed?: boolean | null
          name?: string
          position?: number | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_categories_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_reads: {
        Row: {
          channel_id: string
          id: string
          last_read_at: string | null
          last_read_message_id: string | null
          mention_count: number | null
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          mention_count?: number | null
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          last_read_at?: string | null
          last_read_message_id?: string | null
          mention_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_reads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          category_id: string | null
          created_at: string | null
          icon: string | null
          id: string
          is_nsfw: boolean | null
          name: string
          position: number | null
          server_id: string
          slowmode_seconds: number | null
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"] | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_nsfw?: boolean | null
          name: string
          position?: number | null
          server_id: string
          slowmode_seconds?: number | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"] | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          is_nsfw?: boolean | null
          name?: string
          position?: number | null
          server_id?: string
          slowmode_seconds?: number | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_attachments: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          height: number | null
          id: string
          message_id: string
          width: number | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          height?: number | null
          id?: string
          message_id: string
          width?: number | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          height?: number | null
          id?: string
          message_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_conversations: {
        Row: {
          created_at: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
        }
        Relationships: []
      }
      dm_participants: {
        Row: {
          conversation_id: string
          id: string
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_reactions: {
        Row: {
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string | null
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"] | null
        }
        Insert: {
          addressee_id: string
          created_at?: string | null
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"] | null
        }
        Update: {
          addressee_id?: string
          created_at?: string | null
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mentions: {
        Row: {
          id: string
          mention_type: Database["public"]["Enums"]["mention_type"] | null
          message_id: string
          user_id: string
        }
        Insert: {
          id?: string
          mention_type?: Database["public"]["Enums"]["mention_type"] | null
          message_id: string
          user_id: string
        }
        Update: {
          id?: string
          mention_type?: Database["public"]["Enums"]["mention_type"] | null
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          height: number | null
          id: string
          message_id: string
          width: number | null
        }
        Insert: {
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          height?: number | null
          id?: string
          message_id: string
          width?: number | null
        }
        Update: {
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          height?: number | null
          id?: string
          message_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          is_pinned: boolean | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_pinned?: boolean | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          is_pinned?: boolean | null
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reactions: {
        Row: {
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      server_members: {
        Row: {
          id: string
          is_banned: boolean | null
          is_muted: boolean | null
          joined_at: string | null
          nickname: string | null
          role: Database["public"]["Enums"]["server_role"] | null
          server_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_banned?: boolean | null
          is_muted?: boolean | null
          joined_at?: string | null
          nickname?: string | null
          role?: Database["public"]["Enums"]["server_role"] | null
          server_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_banned?: boolean | null
          is_muted?: boolean | null
          joined_at?: string | null
          nickname?: string | null
          role?: Database["public"]["Enums"]["server_role"] | null
          server_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_members_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          banner_url: string | null
          created_at: string | null
          icon_url: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string | null
          icon_url?: string | null
          id?: string
          invite_code: string
          name: string
          owner_id: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string | null
          icon_url?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          animate_emojis: boolean
          compact_mode: boolean
          created_at: string
          desktop_notifications_enabled: boolean
          id: string
          link_previews_enabled: boolean
          notification_sound_enabled: boolean
          show_message_preview: boolean
          show_timestamps: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          animate_emojis?: boolean
          compact_mode?: boolean
          created_at?: string
          desktop_notifications_enabled?: boolean
          id?: string
          link_previews_enabled?: boolean
          notification_sound_enabled?: boolean
          show_message_preview?: boolean
          show_timestamps?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          animate_emojis?: boolean
          compact_mode?: boolean
          created_at?: string
          desktop_notifications_enabled?: boolean
          id?: string
          link_previews_enabled?: boolean
          notification_sound_enabled?: boolean
          show_message_preview?: boolean
          show_timestamps?: boolean
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          banner_color: string | null
          bio: string | null
          created_at: string | null
          custom_status: string | null
          display_name: string | null
          id: string
          key_hash: string
          last_seen: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          created_at?: string | null
          custom_status?: string | null
          display_name?: string | null
          id?: string
          key_hash: string
          last_seen?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          banner_color?: string | null
          bio?: string | null
          created_at?: string | null
          custom_status?: string | null
          display_name?: string | null
          id?: string
          key_hash?: string
          last_seen?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_friend_request: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: Json
      }
      add_dm_reaction: {
        Args: { _emoji: string; _message_id: string; _user_id: string }
        Returns: Json
      }
      add_reaction: {
        Args: { _emoji: string; _message_id: string; _user_id: string }
        Returns: Json
      }
      block_user: {
        Args: { _blocked_user_id: string; _user_id: string }
        Returns: Json
      }
      check_username_available: {
        Args: { _username: string }
        Returns: boolean
      }
      create_category: {
        Args: {
          _name: string
          _position?: number
          _server_id: string
          _user_id: string
        }
        Returns: Json
      }
      create_channel: {
        Args: {
          _category_id?: string
          _icon?: string
          _name: string
          _position?: number
          _server_id: string
          _type?: string
          _user_id: string
        }
        Returns: Json
      }
      create_notification: {
        Args: {
          _body?: string
          _link?: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: string
      }
      create_server_with_owner: {
        Args: { _name: string; _owner_id: string }
        Returns: Json
      }
      decline_friend_request: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: boolean
      }
      delete_category: {
        Args: { _category_id: string; _user_id: string }
        Returns: boolean
      }
      delete_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      delete_dm: {
        Args: { _message_id: string; _sender_id: string }
        Returns: boolean
      }
      delete_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      edit_dm: {
        Args: { _content: string; _message_id: string; _sender_id: string }
        Returns: Json
      }
      edit_message: {
        Args: { _content: string; _message_id: string; _user_id: string }
        Returns: Json
      }
      generate_invite_code: { Args: never; Returns: string }
      get_blocked_users: { Args: { _user_id: string }; Returns: Json }
      get_channel_messages: {
        Args: {
          _before_id?: string
          _channel_id: string
          _limit?: number
          _user_id: string
        }
        Returns: Json
      }
      get_channel_server_id: { Args: { _channel_id: string }; Returns: string }
      get_dm_conversation_id: { Args: { _message_id: string }; Returns: string }
      get_dm_messages: {
        Args: {
          _before_id?: string
          _conversation_id: string
          _limit?: number
          _user_id: string
        }
        Returns: Json
      }
      get_outgoing_friend_requests: {
        Args: { _user_id: string }
        Returns: Json
      }
      get_pending_friend_requests: { Args: { _user_id: string }; Returns: Json }
      get_server_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          icon_url: string
          id: string
          invite_code: string
          name: string
        }[]
      }
      get_server_categories: { Args: { _server_id: string }; Returns: Json }
      get_server_channels: { Args: { _server_id: string }; Returns: Json }
      get_server_members: { Args: { _server_id: string }; Returns: Json }
      get_user_by_id: { Args: { _user_id: string }; Returns: Json }
      get_user_dm_conversations: { Args: { _user_id: string }; Returns: Json }
      get_user_friends: { Args: { _user_id: string }; Returns: Json }
      get_user_servers: { Args: { _user_id: string }; Returns: Json }
      is_dm_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_friend_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      join_server_by_invite: {
        Args: { _invite_code: string; _user_id: string }
        Returns: Json
      }
      login_user: { Args: { _key_hash: string }; Returns: Json }
      mark_dm_read: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      open_dm_conversation: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: Json
      }
      register_user: {
        Args: { _banner_color?: string; _key_hash: string; _username: string }
        Returns: Json
      }
      remove_dm_reaction: {
        Args: { _emoji: string; _message_id: string; _user_id: string }
        Returns: boolean
      }
      remove_friend: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: boolean
      }
      remove_reaction: {
        Args: { _emoji: string; _message_id: string; _user_id: string }
        Returns: boolean
      }
      search_messages: {
        Args: {
          channel_filter?: string
          result_limit?: number
          search_query: string
          server_filter?: string
          user_filter?: string
        }
        Returns: {
          channel_id: string
          content: string
          created_at: string
          message_id: string
          rank: number
          user_id: string
        }[]
      }
      send_dm: {
        Args: {
          _content: string
          _conversation_id: string
          _reply_to_id?: string
          _sender_id: string
        }
        Returns: Json
      }
      send_friend_request: {
        Args: { _addressee_username: string; _requester_id: string }
        Returns: Json
      }
      send_message: {
        Args: {
          _channel_id: string
          _content: string
          _reply_to_id?: string
          _user_id: string
        }
        Returns: Json
      }
      shares_dm_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      shares_server_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      toggle_pin_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: Json
      }
      unblock_user: {
        Args: { _blocked_user_id: string; _user_id: string }
        Returns: boolean
      }
      update_category: {
        Args: { _category_id: string; _updates: Json; _user_id: string }
        Returns: Json
      }
      update_channel: {
        Args: { _channel_id: string; _updates: Json; _user_id: string }
        Returns: Json
      }
      update_user_last_seen: { Args: { _user_id: string }; Returns: boolean }
      update_user_profile: {
        Args: { _updates: Json; _user_id: string }
        Returns: Json
      }
      update_user_status: {
        Args: {
          _status: Database["public"]["Enums"]["user_status"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      channel_type: "text" | "voice" | "announcement"
      friendship_status: "pending" | "accepted" | "blocked"
      mention_type: "user" | "everyone" | "here" | "role"
      notification_type: "mention" | "dm" | "friend_request" | "server_invite"
      server_role: "owner" | "admin" | "moderator" | "member"
      user_status: "online" | "idle" | "dnd" | "offline"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      channel_type: ["text", "voice", "announcement"],
      friendship_status: ["pending", "accepted", "blocked"],
      mention_type: ["user", "everyone", "here", "role"],
      notification_type: ["mention", "dm", "friend_request", "server_invite"],
      server_role: ["owner", "admin", "moderator", "member"],
      user_status: ["online", "idle", "dnd", "offline"],
    },
  },
} as const
