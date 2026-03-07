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
      _snapshot_direct_messages_compromise_20260221: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          edited_at: string | null
          id: string | null
          reply_to_id: string | null
          sender_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          edited_at?: string | null
          id?: string | null
          reply_to_id?: string | null
          sender_id?: string | null
        }
        Relationships: []
      }
      announcement_comment_reactions: {
        Row: {
          comment_id: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "announcement_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          message_id: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          message_id: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          message_id?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "announcement_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          action: string
          attempts: number | null
          ip_hash: string
          window_start: string | null
        }
        Insert: {
          action: string
          attempts?: number | null
          ip_hash: string
          window_start?: string | null
        }
        Update: {
          action?: string
          attempts?: number | null
          ip_hash?: string
          window_start?: string | null
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string | null
          description: string | null
          icon_url: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon_url: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon_url?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      category_permissions: {
        Row: {
          allowed: boolean
          category_id: string
          created_at: string | null
          id: string
          permission: string
          role_id: string | null
          role_name: string | null
          user_id: string | null
        }
        Insert: {
          allowed?: boolean
          category_id: string
          created_at?: string | null
          id?: string
          permission: string
          role_id?: string | null
          role_name?: string | null
          user_id?: string | null
        }
        Update: {
          allowed?: boolean
          category_id?: string
          created_at?: string | null
          id?: string
          permission?: string
          role_id?: string | null
          role_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_permissions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "channel_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "server_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
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
      channel_members: {
        Row: {
          added_by: string | null
          channel_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          channel_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          channel_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_permissions: {
        Row: {
          allowed: boolean
          channel_id: string
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_type"]
          role_id: string | null
          role_name: Database["public"]["Enums"]["server_role"] | null
          user_id: string | null
        }
        Insert: {
          allowed: boolean
          channel_id: string
          created_at?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          role_id?: string | null
          role_name?: Database["public"]["Enums"]["server_role"] | null
          user_id?: string | null
        }
        Update: {
          allowed?: boolean
          channel_id?: string
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          role_id?: string | null
          role_name?: Database["public"]["Enums"]["server_role"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_permissions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "server_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "channel_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_user_settings: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          is_hidden: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          mute_until: string | null
          notification_level: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          mute_until?: string | null
          notification_level?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          mute_until?: string | null
          notification_level?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_user_settings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          allowed_link_domains: string[] | null
          block_links: boolean
          category_id: string | null
          created_at: string | null
          ghost_mode: boolean
          icon: string | null
          id: string
          is_nsfw: boolean | null
          is_private: boolean
          is_read_only: boolean | null
          linked_voice_channel_id: string | null
          name: string
          position: number | null
          server_id: string
          slowmode_seconds: number | null
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"] | null
        }
        Insert: {
          allowed_link_domains?: string[] | null
          block_links?: boolean
          category_id?: string | null
          created_at?: string | null
          ghost_mode?: boolean
          icon?: string | null
          id?: string
          is_nsfw?: boolean | null
          is_private?: boolean
          is_read_only?: boolean | null
          linked_voice_channel_id?: string | null
          name: string
          position?: number | null
          server_id: string
          slowmode_seconds?: number | null
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"] | null
        }
        Update: {
          allowed_link_domains?: string[] | null
          block_links?: boolean
          category_id?: string | null
          created_at?: string | null
          ghost_mode?: boolean
          icon?: string | null
          id?: string
          is_nsfw?: boolean | null
          is_private?: boolean
          is_read_only?: boolean | null
          linked_voice_channel_id?: string | null
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
            foreignKeyName: "channels_linked_voice_channel_id_fkey"
            columns: ["linked_voice_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
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
      declined_friend_requests: {
        Row: {
          addressee_id: string
          declined_at: string
          id: string
          requester_id: string
        }
        Insert: {
          addressee_id: string
          declined_at?: string
          id?: string
          requester_id: string
        }
        Update: {
          addressee_id?: string
          declined_at?: string
          id?: string
          requester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "declined_friend_requests_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declined_friend_requests_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declined_friend_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declined_friend_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          created_by: string | null
          id: string
          is_group: boolean | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "dm_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "dm_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      media_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "media_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      media_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          media_id: string
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          media_id: string
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          media_id?: string
          reply_to_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_comments_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comments_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "media_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          channel_id: string
          created_at: string | null
          description: string | null
          file_size: number | null
          height: number | null
          id: string
          media_type: string
          media_url: string
          thumbnail_url: string | null
          title: string | null
          user_id: string
          width: number | null
          youtube_video_id: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          media_type: string
          media_url: string
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
          width?: number | null
          youtube_video_id?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          description?: string | null
          file_size?: number | null
          height?: number | null
          id?: string
          media_type?: string
          media_url?: string
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
          width?: number | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "mentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          embed_hidden: boolean
          id: string
          is_pinned: boolean | null
          is_system_message: boolean | null
          reply_to_id: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string | null
          edited_at?: string | null
          embed_hidden?: boolean
          id?: string
          is_pinned?: boolean | null
          is_system_message?: boolean | null
          reply_to_id?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string | null
          edited_at?: string | null
          embed_hidden?: boolean
          id?: string
          is_pinned?: boolean | null
          is_system_message?: boolean | null
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
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
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
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          created_at: string
          id: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          allow_multiple: boolean
          channel_id: string
          created_at: string
          created_by: string
          ends_at: string
          id: string
          is_closed: boolean
          message_id: string
          options: string[]
          question: string
          results: Json
          total_votes: number
        }
        Insert: {
          allow_multiple?: boolean
          channel_id: string
          created_at?: string
          created_by: string
          ends_at: string
          id?: string
          is_closed?: boolean
          message_id: string
          options: string[]
          question: string
          results?: Json
          total_votes?: number
        }
        Update: {
          allow_multiple?: boolean
          channel_id?: string
          created_at?: string
          created_by?: string
          ends_at?: string
          id?: string
          is_closed?: boolean
          message_id?: string
          options?: string[]
          question?: string
          results?: Json
          total_votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "polls_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      pow_challenges: {
        Row: {
          created_at: string
          difficulty: number
          expires_at: string
          id: string
          nonce: string
          used: boolean | null
        }
        Insert: {
          created_at?: string
          difficulty?: number
          expires_at?: string
          id?: string
          nonce: string
          used?: boolean | null
        }
        Update: {
          created_at?: string
          difficulty?: number
          expires_at?: string
          id?: string
          nonce?: string
          used?: boolean | null
        }
        Relationships: []
      }
      reactions: {
        Row: {
          channel_id: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          channel_id?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          allowed: boolean
          created_at: string | null
          id: string
          permission: Database["public"]["Enums"]["permission_type"]
          role_id: string | null
          role_name: Database["public"]["Enums"]["server_role"] | null
          server_id: string
        }
        Insert: {
          allowed?: boolean
          created_at?: string | null
          id?: string
          permission: Database["public"]["Enums"]["permission_type"]
          role_id?: string | null
          role_name?: Database["public"]["Enums"]["server_role"] | null
          server_id: string
        }
        Update: {
          allowed?: boolean
          created_at?: string | null
          id?: string
          permission?: Database["public"]["Enums"]["permission_type"]
          role_id?: string | null
          role_name?: Database["public"]["Enums"]["server_role"] | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "server_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_emojis: {
        Row: {
          created_at: string
          created_by: string
          file_path: string
          id: string
          name: string
          server_id: string
          short_id: number
        }
        Insert: {
          created_at?: string
          created_by: string
          file_path: string
          id?: string
          name: string
          server_id: string
          short_id?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          file_path?: string
          id?: string
          name?: string
          server_id?: string
          short_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "server_emojis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_emojis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_emojis_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          revoked_at: string | null
          revoked_by: string | null
          server_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          server_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          server_id?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "server_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_invites_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_invites_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_invites_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_member_roles: {
        Row: {
          created_at: string | null
          id: string
          member_id: string
          role_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          member_id: string
          role_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          member_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_member_roles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "server_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_member_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "server_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      server_members: {
        Row: {
          id: string
          is_banned: boolean
          is_muted: boolean | null
          join_invite_code: string | null
          join_source: string | null
          joined_at: string | null
          nickname: string | null
          position: number | null
          role: Database["public"]["Enums"]["server_role"] | null
          server_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_banned?: boolean
          is_muted?: boolean | null
          join_invite_code?: string | null
          join_source?: string | null
          joined_at?: string | null
          nickname?: string | null
          position?: number | null
          role?: Database["public"]["Enums"]["server_role"] | null
          server_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_banned?: boolean
          is_muted?: boolean | null
          join_invite_code?: string | null
          join_source?: string | null
          joined_at?: string | null
          nickname?: string | null
          position?: number | null
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
          {
            foreignKeyName: "server_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      server_roles: {
        Row: {
          color: string
          created_at: string | null
          icon: string | null
          id: string
          name: string
          position: number | null
          server_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number | null
          server_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number | null
          server_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_roles_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          about: string | null
          banner_url: string | null
          created_at: string | null
          enable_join_messages: boolean | null
          enable_leave_messages: boolean | null
          icon_url: string | null
          id: string
          invite_code: string
          is_published: boolean
          is_verified: boolean
          name: string
          owner_id: string
          system_channel_join_id: string | null
          system_channel_leave_id: string | null
        }
        Insert: {
          about?: string | null
          banner_url?: string | null
          created_at?: string | null
          enable_join_messages?: boolean | null
          enable_leave_messages?: boolean | null
          icon_url?: string | null
          id?: string
          invite_code: string
          is_published?: boolean
          is_verified?: boolean
          name: string
          owner_id: string
          system_channel_join_id?: string | null
          system_channel_leave_id?: string | null
        }
        Update: {
          about?: string | null
          banner_url?: string | null
          created_at?: string | null
          enable_join_messages?: boolean | null
          enable_leave_messages?: boolean | null
          icon_url?: string | null
          id?: string
          invite_code?: string
          is_published?: boolean
          is_verified?: boolean
          name?: string
          owner_id?: string
          system_channel_join_id?: string | null
          system_channel_leave_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servers_system_channel_join_id_fkey"
            columns: ["system_channel_join_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servers_system_channel_leave_id_fkey"
            columns: ["system_channel_leave_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_attachments: {
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
            foreignKeyName: "thread_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          content: string
          created_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_reactions: {
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
            foreignKeyName: "thread_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "thread_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          channel_id: string
          created_at: string | null
          created_by: string
          id: string
          message_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          created_by: string
          id?: string
          message_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          created_by?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_auth: {
        Row: {
          key_hash: string
          last_key_reset_at: string | null
          user_id: string
        }
        Insert: {
          key_hash: string
          last_key_reset_at?: string | null
          user_id: string
        }
        Update: {
          key_hash?: string
          last_key_reset_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_auth_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_auth_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string | null
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string | null
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string | null
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          created_at: string | null
          device_id: number
          device_name: string | null
          id: string
          identity_public_key: string
          last_active: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_id: number
          device_name?: string | null
          id?: string
          identity_public_key: string
          last_active?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_id?: number
          device_name?: string | null
          id?: string
          identity_public_key?: string
          last_active?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_devices_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          animate_emojis: boolean
          browser_notifications_enabled: boolean | null
          compact_mode: boolean
          created_at: string
          desktop_notifications_enabled: boolean
          dm_privacy: string
          enable_dm_notifications: boolean
          enable_friend_request_notifications: boolean
          enable_mention_notifications: boolean
          enable_server_invite_notifications: boolean
          id: string
          link_previews_enabled: boolean
          notification_sound_enabled: boolean
          notification_sound_replies: boolean | null
          notification_sound_server_mentions: boolean | null
          notification_sound_user_mentions: boolean | null
          notification_volume: number | null
          show_message_preview: boolean
          show_preview_replies: boolean | null
          show_preview_server_mentions: boolean | null
          show_preview_user_mentions: boolean | null
          show_timestamps: boolean
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          animate_emojis?: boolean
          browser_notifications_enabled?: boolean | null
          compact_mode?: boolean
          created_at?: string
          desktop_notifications_enabled?: boolean
          dm_privacy?: string
          enable_dm_notifications?: boolean
          enable_friend_request_notifications?: boolean
          enable_mention_notifications?: boolean
          enable_server_invite_notifications?: boolean
          id?: string
          link_previews_enabled?: boolean
          notification_sound_enabled?: boolean
          notification_sound_replies?: boolean | null
          notification_sound_server_mentions?: boolean | null
          notification_sound_user_mentions?: boolean | null
          notification_volume?: number | null
          show_message_preview?: boolean
          show_preview_replies?: boolean | null
          show_preview_server_mentions?: boolean | null
          show_preview_user_mentions?: boolean | null
          show_timestamps?: boolean
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          animate_emojis?: boolean
          browser_notifications_enabled?: boolean | null
          compact_mode?: boolean
          created_at?: string
          desktop_notifications_enabled?: boolean
          dm_privacy?: string
          enable_dm_notifications?: boolean
          enable_friend_request_notifications?: boolean
          enable_mention_notifications?: boolean
          enable_server_invite_notifications?: boolean
          id?: string
          link_previews_enabled?: boolean
          notification_sound_enabled?: boolean
          notification_sound_replies?: boolean | null
          notification_sound_server_mentions?: boolean | null
          notification_sound_user_mentions?: boolean | null
          notification_volume?: number | null
          show_message_preview?: boolean
          show_preview_replies?: boolean | null
          show_preview_server_mentions?: boolean | null
          show_preview_user_mentions?: boolean | null
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
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_server_folders: {
        Row: {
          folder_data: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          folder_data?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          folder_data?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_server_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_server_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_server_tabs: {
        Row: {
          id: string
          tab_order: string[]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          tab_order?: string[]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          tab_order?: string[]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_server_tabs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_server_tabs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_voice_settings: {
        Row: {
          created_at: string
          id: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_voice_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_voice_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users_public"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_decoration: string | null
          avatar_url: string | null
          banner_color: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          custom_status: string | null
          display_name: string | null
          id: string
          is_bot: boolean
          last_seen: string | null
          profile_effect: string | null
          profile_theme_accent: string | null
          profile_theme_primary: string | null
          pronouns: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          username: string
        }
        Insert: {
          avatar_decoration?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          custom_status?: string | null
          display_name?: string | null
          id?: string
          is_bot?: boolean
          last_seen?: string | null
          profile_effect?: string | null
          profile_theme_accent?: string | null
          profile_theme_primary?: string | null
          pronouns?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          username: string
        }
        Update: {
          avatar_decoration?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          custom_status?: string | null
          display_name?: string | null
          id?: string
          is_bot?: boolean
          last_seen?: string | null
          profile_effect?: string | null
          profile_theme_accent?: string | null
          profile_theme_primary?: string | null
          pronouns?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      users_public: {
        Row: {
          avatar_decoration: string | null
          avatar_url: string | null
          banner_color: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          custom_status: string | null
          display_name: string | null
          id: string | null
          is_bot: boolean | null
          last_seen: string | null
          profile_effect: string | null
          profile_theme_accent: string | null
          profile_theme_primary: string | null
          pronouns: string | null
          status: Database["public"]["Enums"]["user_status"] | null
          username: string | null
        }
        Insert: {
          avatar_decoration?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          custom_status?: string | null
          display_name?: string | null
          id?: string | null
          is_bot?: boolean | null
          last_seen?: never
          profile_effect?: string | null
          profile_theme_accent?: string | null
          profile_theme_primary?: string | null
          pronouns?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          username?: string | null
        }
        Update: {
          avatar_decoration?: string | null
          avatar_url?: string | null
          banner_color?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          custom_status?: string | null
          display_name?: string | null
          id?: string | null
          is_bot?: boolean | null
          last_seen?: never
          profile_effect?: string | null
          profile_theme_accent?: string | null
          profile_theme_primary?: string | null
          pronouns?: string | null
          status?: Database["public"]["Enums"]["user_status"] | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_friend_request: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: Json
      }
      add_channel_member: {
        Args: {
          _added_by: string
          _channel_id: string
          _target_user_id: string
        }
        Returns: boolean
      }
      add_dm_reaction: {
        Args: { _emoji: string; _message_id: string; _user_id: string }
        Returns: Json
      }
      add_group_dm_members: {
        Args: {
          _conversation_id: string
          _new_member_ids: string[]
          _user_id: string
        }
        Returns: Json
      }
      add_reaction: {
        Args: { _emoji: string; _message_id: string; _user_id: string }
        Returns: Json
      }
      assert_function_execute_surface_strict: {
        Args: never
        Returns: undefined
      }
      assert_no_dangerous_table_privileges: { Args: never; Returns: undefined }
      assert_request_user: {
        Args: { _expected_user_id: string }
        Returns: string
      }
      assign_role_to_member: {
        Args: { _member_id: string; _role_id: string; _user_id: string }
        Returns: undefined
      }
      assign_task_users: {
        Args: { _assignee_ids: string[]; _task_id: string; _user_id: string }
        Returns: Json
      }
      audit_function_execute_surface: {
        Args: never
        Returns: {
          anon_exec: boolean
          authenticated_exec: boolean
          function_name: string
          identity_args: string
          is_security_definer: boolean
          public_exec: boolean
        }[]
      }
      audit_table_dangerous_privileges: {
        Args: never
        Returns: {
          grantee: string
          privilege_type: string
          table_name: string
        }[]
      }
      ban_member: {
        Args: { _server_id: string; _target_user_id: string; _user_id: string }
        Returns: undefined
      }
      block_user: {
        Args: { _blocked_user_id: string; _user_id: string }
        Returns: Json
      }
      can_access_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_user: {
        Args: { _requesting_user_id: string; _target_user_id: string }
        Returns: boolean
      }
      change_member_role: {
        Args: {
          _new_role: Database["public"]["Enums"]["server_role"]
          _server_id: string
          _target_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      check_e2e_status: { Args: { _user_id: string }; Returns: boolean }
      check_rate_limit: {
        Args: {
          _action: string
          _ip_hash: string
          _max_attempts: number
          _window_seconds: number
        }
        Returns: boolean
      }
      check_server_membership: { Args: { _server_id: string }; Returns: Json }
      check_user_permission: {
        Args: {
          _channel_id: string
          _permission: Database["public"]["Enums"]["permission_type"]
          _user_id: string
        }
        Returns: boolean
      }
      check_user_server_permission: {
        Args: {
          _permission: Database["public"]["Enums"]["permission_type"]
          _server_id: string
          _user_id: string
        }
        Returns: boolean
      }
      check_username_available: {
        Args: { _username: string }
        Returns: boolean
      }
      cleanup_pow_challenges: { Args: never; Returns: undefined }
      close_dm_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: Json
      }
      close_expired_polls: { Args: { _channel_id: string }; Returns: number }
      close_poll: { Args: { _poll_id: string }; Returns: boolean }
      count_available_prekeys: {
        Args: { _device_id: number; _user_id: string }
        Returns: number
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
          _ghost_mode?: boolean
          _icon?: string
          _is_private?: boolean
          _name: string
          _position?: number
          _server_id: string
          _type?: string
          _user_id?: string
        }
        Returns: Json
      }
      create_group_dm: {
        Args: {
          _creator_id: string
          _name?: string
          _participant_ids: string[]
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
      create_server_invite: {
        Args: {
          _expires_in_seconds?: number
          _max_uses?: number
          _server_id: string
          _user_id: string
        }
        Returns: string
      }
      create_server_role: {
        Args: {
          _color?: string
          _icon?: string
          _name: string
          _server_id: string
          _user_id: string
        }
        Returns: Json
      }
      create_server_with_owner: {
        Args: { _name: string; _owner_id: string }
        Returns: Json
      }
      create_task: {
        Args: {
          _assignee_ids?: string[]
          _channel_id: string
          _description?: string
          _due_date?: string
          _priority?: string
          _title: string
          _user_id: string
        }
        Returns: Json
      }
      create_task_comment: {
        Args: {
          _content: string
          _reply_to_id?: string
          _task_id: string
          _user_id: string
        }
        Returns: Json
      }
      create_thread: {
        Args: { _message_id: string; _user_id: string }
        Returns: string
      }
      debug_channel_permissions: {
        Args: { _channel_id: string; _user_id: string }
        Returns: Json
      }
      debug_request_headers: { Args: never; Returns: Json }
      debug_server_system_messages: {
        Args: { _server_id: string }
        Returns: Json
      }
      debug_user_permission: {
        Args: {
          _channel_id: string
          _permission: Database["public"]["Enums"]["permission_type"]
          _user_id: string
        }
        Returns: Json
      }
      decline_friend_request: {
        Args: { _friendship_id: string; _user_id: string }
        Returns: boolean
      }
      delete_announcement_comment: {
        Args: { _comment_id: string; _user_id: string }
        Returns: boolean
      }
      delete_category: {
        Args: { _category_id: string; _user_id: string }
        Returns: undefined
      }
      delete_category_permission: {
        Args: { _permission_id: string; _user_id: string }
        Returns: undefined
      }
      delete_channel: {
        Args: { _channel_id: string; _user_id: string }
        Returns: undefined
      }
      delete_channel_permission: {
        Args: { _permission_id: string; _user_id: string }
        Returns: undefined
      }
      delete_dm: {
        Args: { _message_id: string; _sender_id: string }
        Returns: boolean
      }
      delete_forum_thread: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      delete_media_comment: {
        Args: { _comment_id: string; _user_id: string }
        Returns: boolean
      }
      delete_media_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: boolean
      }
      delete_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: undefined
      }
      delete_role_permission: {
        Args: { _permission_id: string; _user_id: string }
        Returns: undefined
      }
      delete_server: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      delete_server_emoji: {
        Args: { _emoji_id: string; _user_id: string }
        Returns: string
      }
      delete_server_role: {
        Args: { _role_id: string; _user_id: string }
        Returns: undefined
      }
      delete_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: Json
      }
      delete_task_comment: {
        Args: { _comment_id: string; _user_id: string }
        Returns: Json
      }
      delete_thread_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      delete_user_account: { Args: { _user_id: string }; Returns: boolean }
      edit_announcement_comment: {
        Args: { _comment_id: string; _content: string; _user_id: string }
        Returns: boolean
      }
      edit_dm: {
        Args: { _content: string; _message_id: string; _sender_id: string }
        Returns: Json
      }
      edit_media_comment: {
        Args: { _comment_id: string; _content: string; _user_id: string }
        Returns: boolean
      }
      edit_message: {
        Args: { _content: string; _message_id: string; _user_id: string }
        Returns: Json
      }
      fetch_key_backup: { Args: { _user_id: string }; Returns: Json }
      fetch_prekey_bundle: { Args: { _target_user_id: string }; Returns: Json }
      generate_invite_code: { Args: never; Returns: string }
      get_all_channel_unread_counts: {
        Args: {
          _blocked_user_ids?: string[]
          _channel_ids: string[]
          _user_id: string
        }
        Returns: {
          channel_id: string
          first_unread_message_id: string
          last_read_at: string
          last_read_message_id: string
          mention_count: number
          unread_count: number
        }[]
      }
      get_banned_members: {
        Args: { _server_id: string; _user_id: string }
        Returns: Json
      }
      get_blocked_user_ids_for_visibility: {
        Args: { _user_id: string }
        Returns: Json
      }
      get_blocked_users: { Args: { _user_id: string }; Returns: Json }
      get_category_permissions: {
        Args: { _category_id: string }
        Returns: Json
      }
      get_channel_bootstrap_secure: {
        Args: {
          _blocked_user_ids?: string[]
          _channel_id: string
          _limit?: number
          _user_id: string
        }
        Returns: Json
      }
      get_channel_members: { Args: { _channel_id: string }; Returns: Json }
      get_channel_messages: {
        Args: {
          _before_id?: string
          _channel_id: string
          _limit?: number
          _user_id: string
        }
        Returns: Json
      }
      get_channel_messages_secure: {
        Args: {
          _before?: string
          _blocked_user_ids?: string[]
          _channel_id: string
          _limit?: number
          _user_id: string
        }
        Returns: Json
      }
      get_channel_permissions: { Args: { _channel_id: string }; Returns: Json }
      get_channel_server_id: { Args: { _channel_id: string }; Returns: string }
      get_channel_tasks: {
        Args: {
          _channel_id: string
          _sort_by?: string
          _sort_order?: string
          _status_filter?: string
          _user_id: string
        }
        Returns: Json
      }
      get_deletion_preview: { Args: { _user_id: string }; Returns: Json }
      get_dm_conversation_id: { Args: { _message_id: string }; Returns: string }
      get_dm_message_conversation_secure: {
        Args: { _message_id: string; _user_id: string }
        Returns: string
      }
      get_dm_messages: {
        Args: {
          _before_id?: string
          _conversation_id: string
          _limit?: number
          _user_id: string
        }
        Returns: Json
      }
      get_dm_messages_by_ids_secure: {
        Args: { _message_ids: string[]; _user_id: string }
        Returns: Json
      }
      get_dm_other_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: string
      }
      get_dm_unread_counts: {
        Args: { _user_id: string }
        Returns: {
          conversation_id: string
          last_read_at: string
          unread_count: number
        }[]
      }
      get_explore_servers: { Args: never; Returns: Json }
      get_friend_dashboard: { Args: { _user_id: string }; Returns: Json }
      get_invite_details_by_code: {
        Args: { _invite_code: string }
        Returns: {
          about: string
          banner_url: string
          icon_url: string
          id: string
          invite_code: string
          inviter_username: string
          name: string
        }[]
      }
      get_invite_details_by_codes_secure: {
        Args: { _invite_codes: string[] }
        Returns: {
          icon_url: string
          id: string
          invite_code: string
          inviter_username: string
          name: string
        }[]
      }
      get_maintenance_mode: { Args: never; Returns: boolean }
      get_message_author_styles_secure: {
        Args: {
          _server_id: string
          _target_user_ids: string[]
          _user_id: string
        }
        Returns: Json
      }
      get_message_replies_secure: {
        Args: {
          _blocked_user_ids?: string[]
          _message_ids: string[]
          _user_id: string
        }
        Returns: Json
      }
      get_messages_by_ids_secure: {
        Args: {
          _blocked_user_ids?: string[]
          _message_ids: string[]
          _user_id: string
        }
        Returns: Json
      }
      get_outgoing_friend_requests: {
        Args: { _user_id: string }
        Returns: Json
      }
      get_pending_friend_requests: { Args: { _user_id: string }; Returns: Json }
      get_pinned_messages_secure: {
        Args: {
          _blocked_user_ids?: string[]
          _channel_id: string
          _user_id: string
        }
        Returns: Json
      }
      get_request_user_id: { Args: never; Returns: string }
      get_role_permissions: { Args: { _server_id: string }; Returns: Json }
      get_server_by_invite_code: {
        Args: { _invite_code: string }
        Returns: {
          icon_url: string
          id: string
          invite_code: string
          name: string
        }[]
      }
      get_server_categories: {
        Args: { _server_id: string; _user_id?: string }
        Returns: Json
      }
      get_server_channels: {
        Args: { _server_id: string; _user_id?: string }
        Returns: Json
      }
      get_server_member_count_secure: {
        Args: { _server_id: string; _user_id: string }
        Returns: number
      }
      get_server_members: { Args: { _server_id: string }; Returns: Json }
      get_server_members_full_secure: {
        Args: { _server_id: string; _user_id: string }
        Returns: Json
      }
      get_server_members_offline: {
        Args: { _server_id: string }
        Returns: Json
      }
      get_server_members_offline_page_secure: {
        Args: {
          _cursor_joined_at?: string
          _cursor_member_id?: string
          _include_count?: boolean
          _limit?: number
          _server_id: string
          _user_id: string
        }
        Returns: Json
      }
      get_server_members_online: { Args: { _server_id: string }; Returns: Json }
      get_server_mention_candidates_secure: {
        Args: {
          _limit?: number
          _query?: string
          _server_id: string
          _user_id: string
        }
        Returns: Json
      }
      get_server_recent_announcements_secure: {
        Args: { _limit?: number; _server_id: string; _user_id: string }
        Returns: Json
      }
      get_server_roles: { Args: { _server_id: string }; Returns: Json }
      get_server_roles_secure: {
        Args: { _server_id: string; _user_id: string }
        Returns: Json
      }
      get_shared_server_ids_secure: {
        Args: {
          _requesting_user_id: string
          _server_ids: string[]
          _target_user_id: string
        }
        Returns: Json
      }
      get_task_comments: {
        Args: { _task_id: string; _user_id: string }
        Returns: Json
      }
      get_thread_by_message_id: { Args: { _message_id: string }; Returns: Json }
      get_thread_info: { Args: { _message_id: string }; Returns: Json }
      get_thread_message_count: {
        Args: { _message_id: string }
        Returns: number
      }
      get_thread_message_thread_id: {
        Args: { _message_id: string }
        Returns: string
      }
      get_thread_messages: {
        Args: { _before?: string; _limit?: number; _thread_id: string }
        Returns: Json
      }
      get_thread_summaries: { Args: { _thread_ids: string[] }; Returns: Json }
      get_user_badges_secure: {
        Args: { _requesting_user_id: string; _target_user_id: string }
        Returns: Json
      }
      get_user_by_id: { Args: { _user_id: string }; Returns: Json }
      get_user_dm_conversation_ids_secure: {
        Args: { _user_id: string }
        Returns: Json
      }
      get_user_dm_conversations: {
        Args: { _user_id: string }
        Returns: {
          conversation: Json
          last_message: Json
          participants: Json
        }[]
      }
      get_user_friends: { Args: { _user_id: string }; Returns: Json }
      get_user_poll_votes: {
        Args: { _poll_id: string; _user_id: string }
        Returns: number[]
      }
      get_user_preferences: { Args: { _user_id: string }; Returns: Json }
      get_user_profile_secure: {
        Args: { _requesting_user_id: string; _target_user_id: string }
        Returns: Json
      }
      get_user_server_folders: { Args: { _user_id: string }; Returns: Json }
      get_user_server_tabs: { Args: { _user_id: string }; Returns: string[] }
      get_user_servers: { Args: { _user_id: string }; Returns: Json }
      get_user_voice_settings: { Args: { p_user_id: string }; Returns: Json }
      get_users_basic_secure: {
        Args: { _target_user_ids: string[]; _user_id: string }
        Returns: Json
      }
      get_users_presence_secure: {
        Args: { _target_user_ids: string[]; _user_id: string }
        Returns: Json
      }
      has_channel_access: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      has_private_channel_access: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      insert_announcement_comment: {
        Args: {
          _content: string
          _message_id: string
          _reply_to_id?: string
          _user_id: string
        }
        Returns: Json
      }
      insert_media_comment: {
        Args: {
          _content: string
          _media_id: string
          _reply_to_id?: string
          _user_id: string
        }
        Returns: Json
      }
      insert_media_item: {
        Args: {
          _channel_id: string
          _description?: string
          _file_size?: number
          _height?: number
          _media_type?: string
          _media_url?: string
          _thumbnail_url?: string
          _title?: string
          _user_id: string
          _width?: number
          _youtube_video_id?: string
        }
        Returns: Json
      }
      insert_mentions: {
        Args: { _mentions: Json; _user_id: string }
        Returns: undefined
      }
      is_category_server_member: {
        Args: { _category_id: string; _user_id: string }
        Returns: boolean
      }
      is_channel_server_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_dm_message_participant: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      is_dm_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_friend_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_maintenance_active: { Args: never; Returns: boolean }
      is_media_channel_member: {
        Args: { _media_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_in_same_server: {
        Args: { _member_id: string; _user_id: string }
        Returns: boolean
      }
      is_message_channel_member: {
        Args: { _message_id: string; _user_id: string }
        Returns: boolean
      }
      is_safe_storage_object_key: {
        Args: { _bucket_id: string; _name: string }
        Returns: boolean
      }
      is_server_admin_or_owner: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_server_banned_secure: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_server_member: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_channel_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_unicode_emoji: { Args: { _emoji: string }; Returns: boolean }
      is_username_blocked: { Args: { username: string }; Returns: boolean }
      join_server_by_invite: {
        Args: { _invite_code: string; _join_source?: string; _user_id: string }
        Returns: Json
      }
      kick_group_dm_member: {
        Args: {
          _conversation_id: string
          _kicker_id: string
          _target_user_id: string
        }
        Returns: boolean
      }
      kick_member: {
        Args: { _server_id: string; _target_user_id: string; _user_id: string }
        Returns: undefined
      }
      leave_group_dm: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: Json
      }
      leave_server: {
        Args: { _server_id: string; _user_id: string }
        Returns: boolean
      }
      list_server_invites: {
        Args: { _server_id: string; _user_id: string }
        Returns: {
          code: string
          created_at: string
          created_by: string
          created_by_username: string
          expires_at: string
          id: string
          max_uses: number
          revoked_at: string
          revoked_by: string
          revoked_by_username: string
          uses_count: number
        }[]
      }
      login_user: { Args: { _key_hash: string }; Returns: Json }
      mark_channel_read: {
        Args: {
          _channel_id: string
          _last_read_at?: string
          _last_read_message_id: string
          _user_id: string
        }
        Returns: boolean
      }
      mark_channels_read: {
        Args: {
          _channel_ids: string[]
          _last_read_at?: string
          _user_id: string
        }
        Returns: boolean
      }
      mark_dm_read: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      move_channel_to_category: {
        Args: { _category_id?: string; _channel_id: string; _server_id: string }
        Returns: boolean
      }
      mute_member: {
        Args: {
          _mute?: boolean
          _server_id: string
          _target_user_id: string
          _user_id: string
        }
        Returns: undefined
      }
      open_dm_conversation: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: Json
      }
      pin_message: {
        Args: { _message_id: string; _pinned: boolean; _user_id: string }
        Returns: undefined
      }
      ping_health: { Args: never; Returns: boolean }
      post_system_message: {
        Args: { _channel_id: string; _content: string; _user_id: string }
        Returns: string
      }
      publish_e2e_key_bundle: {
        Args: {
          _backup_iv: string
          _backup_salt: string
          _device_id: number
          _device_name: string
          _encrypted_private_key: string
          _key_fingerprint: string
          _prekeys: Json
          _public_key: string
          _registration_id: number
          _signed_prekey_id: number
          _signed_prekey_public: string
          _signed_prekey_signature: string
          _user_id: string
        }
        Returns: boolean
      }
      recompute_poll_results: { Args: { _poll_id: string }; Returns: undefined }
      regenerate_invite_code: {
        Args: { _server_id: string; _user_id: string }
        Returns: string
      }
      register_user: {
        Args: { _banner_color?: string; _key_hash: string; _username: string }
        Returns: Json
      }
      remove_channel_member: {
        Args: {
          _channel_id: string
          _removed_by: string
          _target_user_id: string
        }
        Returns: boolean
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
      remove_role_from_member: {
        Args: { _member_id: string; _role_id: string; _user_id: string }
        Returns: undefined
      }
      rename_server_emoji: {
        Args: { _emoji_id: string; _new_name: string; _user_id: string }
        Returns: undefined
      }
      reorder_categories: {
        Args: { _category_ids: string[]; _server_id: string; _user_id: string }
        Returns: undefined
      }
      reorder_channels: {
        Args: {
          _channel_id: string
          _new_category_id: string
          _new_position: number
          _server_id: string
          _user_id: string
        }
        Returns: undefined
      }
      reorder_server_roles: {
        Args: {
          _ordered_role_ids: string[]
          _server_id: string
          _user_id: string
        }
        Returns: undefined
      }
      reorder_user_servers: {
        Args: { _server_ids: string[]; _user_id: string }
        Returns: undefined
      }
      replenish_prekeys: {
        Args: { _device_id: number; _prekeys: Json; _user_id: string }
        Returns: number
      }
      request_client_identifier: { Args: never; Returns: string }
      requesting_user_id: { Args: never; Returns: string }
      reset_user_secret_key: {
        Args: { _new_key_hash: string; _user_id: string }
        Returns: Json
      }
      revoke_server_invite: {
        Args: { _invite_id: string; _user_id: string }
        Returns: boolean
      }
      save_user_server_folders: {
        Args: { _folder_data: Json; _user_id: string }
        Returns: boolean
      }
      save_user_server_tabs: {
        Args: { _tab_data: string[]; _user_id: string }
        Returns: undefined
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
      search_users_by_username: {
        Args: { _limit?: number; _query: string; _requesting_user_id: string }
        Returns: {
          avatar_decoration: string
          avatar_url: string
          display_name: string
          id: string
          last_seen: string
          status: string
          username: string
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
      send_poll: {
        Args: {
          _allow_multiple?: boolean
          _channel_id: string
          _duration_seconds?: number
          _options: string[]
          _question: string
          _reply_to_id?: string
          _user_id: string
        }
        Returns: Json
      }
      send_thread_message: {
        Args: {
          _content: string
          _reply_to_id?: string
          _thread_id: string
          _user_id: string
        }
        Returns: Json
      }
      set_category_permission: {
        Args: {
          _allowed: boolean
          _category_id: string
          _permission: string
          _role_id?: string
          _role_name?: string
          _target_user_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      set_channel_permission: {
        Args: {
          _allowed: boolean
          _channel_id: string
          _permission: Database["public"]["Enums"]["permission_type"]
          _role_id?: string
          _role_name?: string
          _target_user_id?: string
          _user_id: string
        }
        Returns: undefined
      }
      set_dm_privacy_preference: {
        Args: { _dm_privacy: string; _user_id: string }
        Returns: undefined
      }
      set_message_embed_hidden: {
        Args: { _hidden: boolean; _message_id: string; _user_id: string }
        Returns: boolean
      }
      set_role_permission: {
        Args: {
          _allowed?: boolean
          _permission: Database["public"]["Enums"]["permission_type"]
          _role_id?: string
          _role_name?: string
          _server_id: string
          _user_id: string
        }
        Returns: undefined
      }
      shares_dm_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      shares_server_with: {
        Args: { _other_user_id: string; _user_id: string }
        Returns: boolean
      }
      sync_category_permissions_to_channels: {
        Args: { _category_id: string; _user_id: string }
        Returns: undefined
      }
      test_channel_permission: {
        Args: {
          _channel_id: string
          _permission: Database["public"]["Enums"]["permission_type"]
          _user_id: string
        }
        Returns: Json
      }
      toggle_announcement_comment_reaction: {
        Args: { _comment_id: string; _emoji: string; _user_id: string }
        Returns: boolean
      }
      toggle_media_comment_reaction: {
        Args: { _comment_id: string; _emoji: string; _user_id: string }
        Returns: boolean
      }
      toggle_mute_member: {
        Args: {
          _muted: boolean
          _server_id: string
          _target_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      toggle_pin_message: {
        Args: { _message_id: string; _user_id: string }
        Returns: Json
      }
      transfer_ownership: {
        Args: { _new_owner_id: string; _server_id: string }
        Returns: boolean
      }
      unassign_task_users: {
        Args: { _assignee_ids: string[]; _task_id: string; _user_id: string }
        Returns: Json
      }
      unban_member: {
        Args: { _server_id: string; _target_user_id: string; _user_id: string }
        Returns: boolean
      }
      unblock_user: {
        Args: { _blocked_user_id: string; _user_id: string }
        Returns: boolean
      }
      unmute_member: {
        Args: { _server_id: string; _target_user_id: string; _user_id: string }
        Returns: undefined
      }
      update_category: {
        Args: { _category_id: string; _updates: string; _user_id: string }
        Returns: Json
      }
      update_channel: {
        Args: { _channel_id: string; _updates: string; _user_id: string }
        Returns: Json
      }
      update_group_dm_name: {
        Args: { _conversation_id: string; _new_name: string; _user_id: string }
        Returns: Json
      }
      update_member_nickname: {
        Args: {
          _nickname: string
          _server_id: string
          _target_user_id: string
          _user_id: string
        }
        Returns: boolean
      }
      update_own_profile: {
        Args: {
          _avatar_url?: string
          _banner_color?: string
          _bio?: string
          _custom_status?: string
          _display_name?: string
          _pronouns?: string
          _status?: Database["public"]["Enums"]["user_status"]
        }
        Returns: undefined
      }
      update_server: {
        Args: { _server_id: string; _updates: Json; _user_id: string }
        Returns: Json
      }
      update_server_role: {
        Args: {
          _color?: string
          _icon?: string
          _name?: string
          _role_id: string
          _user_id: string
        }
        Returns: Json
      }
      update_task: {
        Args: {
          _description?: string
          _due_date?: string
          _priority?: string
          _status?: string
          _task_id: string
          _title?: string
          _user_id: string
        }
        Returns: undefined
      }
      update_task_comment: {
        Args: { _comment_id: string; _content: string; _user_id: string }
        Returns: Json
      }
      update_user_last_seen: { Args: { _user_id: string }; Returns: boolean }
      update_user_presence: { Args: { _user_id: string }; Returns: undefined }
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
      upload_server_emoji: {
        Args: {
          _file_path: string
          _name: string
          _server_id: string
          _user_id: string
        }
        Returns: Json
      }
      upsert_channel_read: {
        Args: { _channel_id: string; _last_read_at: string; _user_id: string }
        Returns: undefined
      }
      upsert_user_preferences: {
        Args: { _prefs: Json; _user_id: string }
        Returns: undefined
      }
      upsert_user_voice_settings: {
        Args: { p_settings: Json; p_user_id: string }
        Returns: Json
      }
      validate_dm_reaction_emoji: {
        Args: { _emoji: string }
        Returns: undefined
      }
      validate_reaction_emoji: {
        Args: { _channel_id: string; _emoji: string; _user_id: string }
        Returns: undefined
      }
      verify_request_identity: { Args: { _user_id: string }; Returns: boolean }
      vote_poll: {
        Args: { _option_indexes: number[]; _poll_id: string; _user_id: string }
        Returns: Json
      }
    }
    Enums: {
      channel_type:
        | "text"
        | "voice"
        | "announcement"
        | "forum"
        | "tasks"
        | "media"
      friendship_status: "pending" | "accepted" | "blocked" | "declined"
      mention_type: "user" | "everyone" | "here" | "role"
      notification_type:
        | "mention"
        | "dm"
        | "friend_request"
        | "server_invite"
        | "task_assignment"
      permission_type:
        | "manage_server"
        | "manage_roles"
        | "manage_channels"
        | "kick_members"
        | "ban_members"
        | "mute_members"
        | "manage_nicknames"
        | "manage_messages"
        | "pin_messages"
        | "send_messages"
        | "add_reactions"
        | "view_channels"
        | "transfer_ownership"
        | "manage_invites"
        | "manage_emojis"
        | "attach_files"
        | "embed_links"
        | "read_message_history"
        | "mention_everyone"
        | "mention_roles"
        | "change_nickname"
        | "use_external_emojis"
        | "manage_webhooks"
        | "manage_threads"
        | "create_instant_invite"
        | "connect"
        | "speak"
        | "use_voice_activation"
        | "deafen_members"
        | "move_members"
        | "use_application_commands"
        | "view_tasks"
        | "create_tasks"
        | "edit_own_tasks"
        | "edit_all_tasks"
        | "assign_tasks"
        | "change_task_status"
        | "delete_tasks"
      server_role: "owner" | "admin" | "moderator" | "member"
      task_priority: "low" | "medium" | "high"
      task_status: "open" | "in_progress" | "completed" | "archived"
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
      channel_type: [
        "text",
        "voice",
        "announcement",
        "forum",
        "tasks",
        "media",
      ],
      friendship_status: ["pending", "accepted", "blocked", "declined"],
      mention_type: ["user", "everyone", "here", "role"],
      notification_type: [
        "mention",
        "dm",
        "friend_request",
        "server_invite",
        "task_assignment",
      ],
      permission_type: [
        "manage_server",
        "manage_roles",
        "manage_channels",
        "kick_members",
        "ban_members",
        "mute_members",
        "manage_nicknames",
        "manage_messages",
        "pin_messages",
        "send_messages",
        "add_reactions",
        "view_channels",
        "transfer_ownership",
        "manage_invites",
        "manage_emojis",
        "attach_files",
        "embed_links",
        "read_message_history",
        "mention_everyone",
        "mention_roles",
        "change_nickname",
        "use_external_emojis",
        "manage_webhooks",
        "manage_threads",
        "create_instant_invite",
        "connect",
        "speak",
        "use_voice_activation",
        "deafen_members",
        "move_members",
        "use_application_commands",
        "view_tasks",
        "create_tasks",
        "edit_own_tasks",
        "edit_all_tasks",
        "assign_tasks",
        "change_task_status",
        "delete_tasks",
      ],
      server_role: ["owner", "admin", "moderator", "member"],
      task_priority: ["low", "medium", "high"],
      task_status: ["open", "in_progress", "completed", "archived"],
      user_status: ["online", "idle", "dnd", "offline"],
    },
  },
} as const
