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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      alpha_signals: {
        Row: {
          category: Database["public"]["Enums"]["alpha_signal_category"]
          confidence_score: number
          content: string
          content_raw: Json | null
          contract_addresses: string[] | null
          created_at: string
          engagement_score: number | null
          has_media: boolean
          id: string
          language: string | null
          media_urls: Json | null
          mentions: string[] | null
          priority: Database["public"]["Enums"]["alpha_signal_priority"]
          processed_at: string | null
          reaction_count: number | null
          reply_count: number | null
          risk_score: number
          sentiment: string | null
          source: Database["public"]["Enums"]["alpha_source_type"]
          source_author: string | null
          source_author_id: string | null
          source_channel: string | null
          source_created_at: string | null
          source_id: string
          tickers: string[] | null
          urls: string[] | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["alpha_signal_category"]
          confidence_score?: number
          content: string
          content_raw?: Json | null
          contract_addresses?: string[] | null
          created_at?: string
          engagement_score?: number | null
          has_media?: boolean
          id?: string
          language?: string | null
          media_urls?: Json | null
          mentions?: string[] | null
          priority?: Database["public"]["Enums"]["alpha_signal_priority"]
          processed_at?: string | null
          reaction_count?: number | null
          reply_count?: number | null
          risk_score?: number
          sentiment?: string | null
          source: Database["public"]["Enums"]["alpha_source_type"]
          source_author?: string | null
          source_author_id?: string | null
          source_channel?: string | null
          source_created_at?: string | null
          source_id: string
          tickers?: string[] | null
          urls?: string[] | null
        }
        Update: {
          category?: Database["public"]["Enums"]["alpha_signal_category"]
          confidence_score?: number
          content?: string
          content_raw?: Json | null
          contract_addresses?: string[] | null
          created_at?: string
          engagement_score?: number | null
          has_media?: boolean
          id?: string
          language?: string | null
          media_urls?: Json | null
          mentions?: string[] | null
          priority?: Database["public"]["Enums"]["alpha_signal_priority"]
          processed_at?: string | null
          reaction_count?: number | null
          reply_count?: number | null
          risk_score?: number
          sentiment?: string | null
          source?: Database["public"]["Enums"]["alpha_source_type"]
          source_author?: string | null
          source_author_id?: string | null
          source_channel?: string | null
          source_created_at?: string | null
          source_id?: string
          tickers?: string[] | null
          urls?: string[] | null
        }
        Relationships: []
      }
      alpha_source_credentials: {
        Row: {
          created_at: string
          credential_type: string
          credential_value: string
          id: string
          is_active: boolean
          source: Database["public"]["Enums"]["alpha_source_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          credential_type: string
          credential_value: string
          id?: string
          is_active?: boolean
          source: Database["public"]["Enums"]["alpha_source_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          credential_type?: string
          credential_value?: string
          id?: string
          is_active?: boolean
          source?: Database["public"]["Enums"]["alpha_source_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alpha_source_credentials_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_addresses: {
        Row: {
          address: string
          chain: Database["public"]["Enums"]["chain_type"]
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          user_id: string
        }
        Insert: {
          address: string
          chain?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          user_id: string
        }
        Update: {
          address?: string
          chain?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          data: Json
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          buy_fee_bps: number
          sell_fee_bps: number
          fee_wallet: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          buy_fee_bps?: number
          sell_fee_bps?: number
          fee_wallet?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          buy_fee_bps?: number
          sell_fee_bps?: number
          fee_wallet?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mint_keys: {
        Row: {
          confirmed_at: string | null
          contract_address: string | null
          created_at: string | null
          created_by: string | null
          creation_signature: string | null
          error_message: string | null
          failed_at: string | null
          id: number
          mint_address: string
          secret_key_bs58: string
          status: string | null
          token_name: string | null
          token_symbol: string | null
        }
        Insert: {
          confirmed_at?: string | null
          contract_address?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_signature?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: number
          mint_address: string
          secret_key_bs58: string
          status?: string | null
          token_name?: string | null
          token_symbol?: string | null
        }
        Update: {
          confirmed_at?: string | null
          contract_address?: string | null
          created_at?: string | null
          created_by?: string | null
          creation_signature?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: number
          mint_address?: string
          secret_key_bs58?: string
          status?: string | null
          token_name?: string | null
          token_symbol?: string | null
        }
        Relationships: []
      }
      password_hashes: {
        Row: {
          created_at: string
          hash: string
          id: string
          salt: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hash: string
          id?: string
          salt: string
          user_id: string
        }
        Update: {
          created_at?: string
          hash?: string
          id?: string
          salt?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_hashes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          token?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      token_transactions: {
        Row: {
          amount_sol: number
          amount_tokens: number | null
          created_at: string
          id: string
          signature: string
          status: Database["public"]["Enums"]["transaction_status"]
          token_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string | null
        }
        Insert: {
          amount_sol: number
          amount_tokens?: number | null
          created_at?: string
          id?: string
          signature: string
          status?: Database["public"]["Enums"]["transaction_status"]
          token_id: string
          type: Database["public"]["Enums"]["transaction_type"]
          user_id?: string | null
        }
        Update: {
          amount_sol?: number
          amount_tokens?: number | null
          created_at?: string
          id?: string
          signature?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          token_id?: string
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tokens: {
        Row: {
          chain: Database["public"]["Enums"]["chain_type"]
          created_at: string
          created_by: string | null
          description: string | null
          error_message: string | null
          id: string
          image_url: string | null
          initial_buy_sol: number | null
          metadata_uri: string | null
          mint_address: string
          name: string
          platform: Database["public"]["Enums"]["platform_type"]
          signature: string | null
          source_tweet_id: string | null
          status: Database["public"]["Enums"]["token_status"]
          symbol: string
          updated_at: string
        }
        Insert: {
          chain?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          initial_buy_sol?: number | null
          metadata_uri?: string | null
          mint_address: string
          name: string
          platform?: Database["public"]["Enums"]["platform_type"]
          signature?: string | null
          source_tweet_id?: string | null
          status?: Database["public"]["Enums"]["token_status"]
          symbol: string
          updated_at?: string
        }
        Update: {
          chain?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          initial_buy_sol?: number | null
          metadata_uri?: string | null
          mint_address?: string
          name?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          signature?: string | null
          source_tweet_id?: string | null
          status?: Database["public"]["Enums"]["token_status"]
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tokens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tweets: {
        Row: {
          author_avatar_url: string | null
          author_display_name: string | null
          author_username: string
          classification: Json | null
          content: string
          created_at: string
          fetched_at: string
          id: string
          is_retweet: boolean
          media_urls: Json | null
          original_author: string | null
          tweet_id: string
          tweet_url: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_display_name?: string | null
          author_username: string
          classification?: Json | null
          content: string
          created_at?: string
          fetched_at?: string
          id?: string
          is_retweet?: boolean
          media_urls?: Json | null
          original_author?: string | null
          tweet_id: string
          tweet_url?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_display_name?: string | null
          author_username?: string
          classification?: Json | null
          content?: string
          created_at?: string
          fetched_at?: string
          id?: string
          is_retweet?: boolean
          media_urls?: Json | null
          original_author?: string | null
          tweet_id?: string
          tweet_url?: string | null
        }
        Relationships: []
      }
      user_alpha_filters: {
        Row: {
          categories:
            | Database["public"]["Enums"]["alpha_signal_category"][]
            | null
          created_at: string
          exclude_keywords: string[] | null
          id: string
          include_keywords: string[] | null
          include_tickers: string[] | null
          is_active: boolean
          max_risk: number | null
          min_confidence: number | null
          min_priority:
            | Database["public"]["Enums"]["alpha_signal_priority"]
            | null
          name: string
          notify_channels: Json | null
          notify_enabled: boolean
          sources: Database["public"]["Enums"]["alpha_source_type"][] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?:
            | Database["public"]["Enums"]["alpha_signal_category"][]
            | null
          created_at?: string
          exclude_keywords?: string[] | null
          id?: string
          include_keywords?: string[] | null
          include_tickers?: string[] | null
          is_active?: boolean
          max_risk?: number | null
          min_confidence?: number | null
          min_priority?:
            | Database["public"]["Enums"]["alpha_signal_priority"]
            | null
          name: string
          notify_channels?: Json | null
          notify_enabled?: boolean
          sources?: Database["public"]["Enums"]["alpha_source_type"][] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?:
            | Database["public"]["Enums"]["alpha_signal_category"][]
            | null
          created_at?: string
          exclude_keywords?: string[] | null
          id?: string
          include_keywords?: string[] | null
          include_tickers?: string[] | null
          is_active?: boolean
          max_risk?: number | null
          min_confidence?: number | null
          min_priority?:
            | Database["public"]["Enums"]["alpha_signal_priority"]
            | null
          name?: string
          notify_channels?: Json | null
          notify_enabled?: boolean
          sources?: Database["public"]["Enums"]["alpha_source_type"][] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_alpha_filters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          card_width: number
          color_theme: string
          created_at: string
          id: string
          image_layout: Database["public"]["Enums"]["image_layout"]
          notifications_enabled: boolean
          pause_on_hover: boolean
          sounds_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          card_width?: number
          color_theme?: string
          created_at?: string
          id?: string
          image_layout?: Database["public"]["Enums"]["image_layout"]
          notifications_enabled?: boolean
          pause_on_hover?: boolean
          sounds_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          card_width?: number
          color_theme?: string
          created_at?: string
          id?: string
          image_layout?: Database["public"]["Enums"]["image_layout"]
          notifications_enabled?: boolean
          pause_on_hover?: boolean
          sounds_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_signal_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          signal_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          signal_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          signal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_signal_interactions_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "alpha_signals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_signal_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          last_login: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          last_login?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      watched_accounts: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          twitter_user_id: string | null
          twitter_username: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          twitter_user_id?: string | null
          twitter_username: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          twitter_user_id?: string | null
          twitter_username?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      watched_discord_channels: {
        Row: {
          channel_id: string
          channel_name: string | null
          created_at: string
          guild_id: string
          guild_name: string | null
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          channel_id: string
          channel_name?: string | null
          created_at?: string
          guild_id: string
          guild_name?: string | null
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          channel_id?: string
          channel_name?: string | null
          created_at?: string
          guild_id?: string
          guild_name?: string | null
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_discord_channels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      watched_subreddits: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          subreddit: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          subreddit: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          subreddit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_subreddits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      watched_telegram_channels: {
        Row: {
          chat_id: string
          chat_name: string | null
          chat_type: string
          created_at: string
          id: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          chat_id: string
          chat_name?: string | null
          chat_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          chat_id?: string
          chat_name?: string | null
          chat_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watched_telegram_channels_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      word_highlights: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          user_id: string
          word: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id: string
          word: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          user_id?: string
          word?: string
        }
        Relationships: [
          {
            foreignKeyName: "word_highlights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_pools: {
        Row: {
          id: string
          user_id: string | null
          public_key: string
          encrypted_private_key: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          public_key: string
          encrypted_private_key: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          public_key?: string
          encrypted_private_key?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_pools_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_launch_preferences: {
        Row: {
          user_id: string
          enable_multi_wallet: boolean
          wallets_to_use: number
          max_per_wallet_sol: number
          amount_variance_bps: number
          timing_jitter_ms: number
          auto_sell: boolean
          auto_top_up: boolean
          min_balance_sol: number
          top_up_amount_sol: number
          initial_buy_sol: number
          slippage: number
          priority_fee: number
          auto_deploy: boolean
          mayhem_mode: boolean
          updated_at: string
        }
        Insert: {
          user_id: string
          enable_multi_wallet?: boolean
          wallets_to_use?: number
          max_per_wallet_sol?: number
          amount_variance_bps?: number
          timing_jitter_ms?: number
          auto_sell?: boolean
          auto_top_up?: boolean
          min_balance_sol?: number
          top_up_amount_sol?: number
          initial_buy_sol?: number
          slippage?: number
          priority_fee?: number
          auto_deploy?: boolean
          mayhem_mode?: boolean
          updated_at?: string
        }
        Update: {
          user_id?: string
          enable_multi_wallet?: boolean
          wallets_to_use?: number
          max_per_wallet_sol?: number
          amount_variance_bps?: number
          timing_jitter_ms?: number
          auto_sell?: boolean
          auto_top_up?: boolean
          min_balance_sol?: number
          top_up_amount_sol?: number
          initial_buy_sol?: number
          slippage?: number
          priority_fee?: number
          auto_deploy?: boolean
          mayhem_mode?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_launch_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      alpha_signal_category:
        | "token_mention"
        | "launch_alert"
        | "whale_movement"
        | "news"
        | "sentiment"
        | "technical"
        | "other"
      alpha_signal_priority: "low" | "medium" | "high" | "urgent"
      alpha_source_type: "discord" | "telegram" | "reddit" | "twitter"
      chain_type: "solana" | "ethereum" | "bnb"
      image_layout: "grid" | "list" | "compact"
      platform_type: "pump" | "bonk" | "bags" | "bnb" | "usd1"
      token_status: "pending" | "creating" | "created" | "failed"
      transaction_status: "pending" | "confirmed" | "failed"
      transaction_type: "buy" | "sell" | "create"
      user_role: "user" | "admin" | "moderator"
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
      alpha_signal_category: [
        "token_mention",
        "launch_alert",
        "whale_movement",
        "news",
        "sentiment",
        "technical",
        "other",
      ],
      alpha_signal_priority: ["low", "medium", "high", "urgent"],
      alpha_source_type: ["discord", "telegram", "reddit", "twitter"],
      chain_type: ["solana", "ethereum", "bnb"],
      image_layout: ["grid", "list", "compact"],
      platform_type: ["pump", "bonk", "bags", "bnb", "usd1"],
      token_status: ["pending", "creating", "created", "failed"],
      transaction_status: ["pending", "confirmed", "failed"],
      transaction_type: ["buy", "sell", "create"],
      user_role: ["user", "admin", "moderator"],
    },
  },
} as const

// Convenience exported types
export type AlphaSignal = Tables<"alpha_signals">
export type AlphaSignalInsert = TablesInsert<"alpha_signals">
export type AlphaSignalCategory = Enums<"alpha_signal_category">
export type AlphaSignalPriority = Enums<"alpha_signal_priority">
export type AlphaSourceType = Enums<"alpha_source_type">

export type User = Tables<"users">
export type UserInsert = TablesInsert<"users">
export type UserUpdate = TablesUpdate<"users">

export type Session = Tables<"sessions">
export type SessionInsert = TablesInsert<"sessions">
export type SessionUpdate = TablesUpdate<"sessions">

export type UserSettings = Tables<"user_settings">
export type UserSettingsInsert = TablesInsert<"user_settings">
export type UserSettingsUpdate = TablesUpdate<"user_settings">

export type WatchedAccount = Tables<"watched_accounts">
export type WatchedAccountInsert = TablesInsert<"watched_accounts">
export type WatchedAccountUpdate = TablesUpdate<"watched_accounts">

export type WatchedDiscordChannel = Tables<"watched_discord_channels">
export type WatchedDiscordChannelInsert = TablesInsert<"watched_discord_channels">
export type WatchedDiscordChannelUpdate = TablesUpdate<"watched_discord_channels">

export type WatchedTelegramChannel = Tables<"watched_telegram_channels">
export type WatchedTelegramChannelInsert = TablesInsert<"watched_telegram_channels">
export type WatchedTelegramChannelUpdate = TablesUpdate<"watched_telegram_channels">

export type WatchedSubreddit = Tables<"watched_subreddits">
export type WatchedSubredditInsert = TablesInsert<"watched_subreddits">
export type WatchedSubredditUpdate = TablesUpdate<"watched_subreddits">

export type WordHighlight = Tables<"word_highlights">
export type WordHighlightInsert = TablesInsert<"word_highlights">
export type WordHighlightUpdate = TablesUpdate<"word_highlights">

export type ContractAddress = Tables<"contract_addresses">
export type ContractAddressInsert = TablesInsert<"contract_addresses">
export type ContractAddressUpdate = TablesUpdate<"contract_addresses">

export type Tweet = Tables<"tweets">
export type TweetInsert = TablesInsert<"tweets">
export type TweetUpdate = TablesUpdate<"tweets">

export type Token = Tables<"tokens">
export type TokenInsert = TablesInsert<"tokens">
export type TokenUpdate = TablesUpdate<"tokens">

export type TokenTransaction = Tables<"token_transactions">
export type TokenTransactionInsert = TablesInsert<"token_transactions">
export type TokenTransactionUpdate = TablesUpdate<"token_transactions">

export type Event = Tables<"events">
export type EventInsert = TablesInsert<"events">
export type EventUpdate = TablesUpdate<"events">

export type PlatformSettings = Tables<"platform_settings">
export type PlatformSettingsInsert = TablesInsert<"platform_settings">
export type PlatformSettingsUpdate = TablesUpdate<"platform_settings">

export type WalletPool = Tables<"wallet_pools">
export type WalletPoolInsert = TablesInsert<"wallet_pools">
export type WalletPoolUpdate = TablesUpdate<"wallet_pools">

export type UserLaunchPreferences = Tables<"user_launch_preferences">
export type UserLaunchPreferencesInsert = TablesInsert<"user_launch_preferences">
export type UserLaunchPreferencesUpdate = TablesUpdate<"user_launch_preferences">

export type UserAlphaFilter = Tables<"user_alpha_filters">
export type UserAlphaFilterInsert = TablesInsert<"user_alpha_filters">
export type UserAlphaFilterUpdate = TablesUpdate<"user_alpha_filters">

export type UserSignalInteraction = Tables<"user_signal_interactions">
export type UserSignalInteractionInsert = TablesInsert<"user_signal_interactions">
export type UserSignalInteractionUpdate = TablesUpdate<"user_signal_interactions">
