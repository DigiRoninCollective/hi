export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          email: string | null;
          created_at: string;
          updated_at: string;
          last_login: string | null;
          is_active: boolean;
          role: 'user' | 'admin' | 'moderator';
        };
        Insert: {
          id?: string;
          username: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
          is_active?: boolean;
          role?: 'user' | 'admin' | 'moderator';
        };
        Update: {
          id?: string;
          username?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
          is_active?: boolean;
          role?: 'user' | 'admin' | 'moderator';
        };
        Relationships: [];
      };
      password_hashes: {
        Row: {
          id: string;
          user_id: string;
          hash: string;
          salt: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          hash: string;
          salt: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          hash?: string;
          salt?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "password_hashes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_settings: {
        Row: {
          id: string;
          user_id: string;
          color_theme: string;
          image_layout: 'grid' | 'list' | 'compact';
          card_width: number;
          pause_on_hover: boolean;
          sounds_enabled: boolean;
          notifications_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          color_theme?: string;
          image_layout?: 'grid' | 'list' | 'compact';
          card_width?: number;
          pause_on_hover?: boolean;
          sounds_enabled?: boolean;
          notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          color_theme?: string;
          image_layout?: 'grid' | 'list' | 'compact';
          card_width?: number;
          pause_on_hover?: boolean;
          sounds_enabled?: boolean;
          notifications_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      watched_accounts: {
        Row: {
          id: string;
          user_id: string;
          twitter_username: string;
          twitter_user_id: string | null;
          display_name: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          twitter_username: string;
          twitter_user_id?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          twitter_username?: string;
          twitter_user_id?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "watched_accounts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      word_highlights: {
        Row: {
          id: string;
          user_id: string;
          word: string;
          color: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word: string;
          color?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          word?: string;
          color?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "word_highlights_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      contract_addresses: {
        Row: {
          id: string;
          user_id: string;
          address: string;
          label: string | null;
          chain: 'solana' | 'ethereum' | 'bnb';
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          address: string;
          label?: string | null;
          chain?: 'solana' | 'ethereum' | 'bnb';
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          address?: string;
          label?: string | null;
          chain?: 'solana' | 'ethereum' | 'bnb';
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contract_addresses_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      tweets: {
        Row: {
          id: string;
          tweet_id: string;
          author_username: string;
          author_display_name: string | null;
          author_avatar_url: string | null;
          content: string;
          media_urls: Json | null;
          tweet_url: string | null;
          is_retweet: boolean;
          original_author: string | null;
          classification: Json | null;
          created_at: string;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          tweet_id: string;
          author_username: string;
          author_display_name?: string | null;
          author_avatar_url?: string | null;
          content: string;
          media_urls?: Json | null;
          tweet_url?: string | null;
          is_retweet?: boolean;
          original_author?: string | null;
          classification?: Json | null;
          created_at?: string;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          tweet_id?: string;
          author_username?: string;
          author_display_name?: string | null;
          author_avatar_url?: string | null;
          content?: string;
          media_urls?: Json | null;
          tweet_url?: string | null;
          is_retweet?: boolean;
          original_author?: string | null;
          classification?: Json | null;
          created_at?: string;
          fetched_at?: string;
        };
        Relationships: [];
      };
      tokens: {
        Row: {
          id: string;
          mint_address: string;
          name: string;
          symbol: string;
          description: string | null;
          image_url: string | null;
          metadata_uri: string | null;
          platform: 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1';
          chain: 'solana' | 'ethereum' | 'bnb';
          created_by: string | null;
          source_tweet_id: string | null;
          initial_buy_sol: number | null;
          signature: string | null;
          status: 'pending' | 'creating' | 'created' | 'failed';
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mint_address: string;
          name: string;
          symbol: string;
          description?: string | null;
          image_url?: string | null;
          metadata_uri?: string | null;
          platform?: 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1';
          chain?: 'solana' | 'ethereum' | 'bnb';
          created_by?: string | null;
          source_tweet_id?: string | null;
          initial_buy_sol?: number | null;
          signature?: string | null;
          status?: 'pending' | 'creating' | 'created' | 'failed';
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          mint_address?: string;
          name?: string;
          symbol?: string;
          description?: string | null;
          image_url?: string | null;
          metadata_uri?: string | null;
          platform?: 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1';
          chain?: 'solana' | 'ethereum' | 'bnb';
          created_by?: string | null;
          source_tweet_id?: string | null;
          initial_buy_sol?: number | null;
          signature?: string | null;
          status?: 'pending' | 'creating' | 'created' | 'failed';
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tokens_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      token_transactions: {
        Row: {
          id: string;
          token_id: string;
          user_id: string | null;
          type: 'buy' | 'sell' | 'create';
          amount_sol: number;
          amount_tokens: number | null;
          signature: string;
          status: 'pending' | 'confirmed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          token_id: string;
          user_id?: string | null;
          type: 'buy' | 'sell' | 'create';
          amount_sol: number;
          amount_tokens?: number | null;
          signature: string;
          status?: 'pending' | 'confirmed' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          token_id?: string;
          user_id?: string | null;
          type?: 'buy' | 'sell' | 'create';
          amount_sol?: number;
          amount_tokens?: number | null;
          signature?: string;
          status?: 'pending' | 'confirmed' | 'failed';
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "token_transactions_token_id_fkey";
            columns: ["token_id"];
            referencedRelation: "tokens";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "token_transactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      events: {
        Row: {
          id: string;
          type: string;
          data: Json;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          data: Json;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          data?: Json;
          user_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "events_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          expires_at: string;
          created_at: string;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          expires_at: string;
          created_at?: string;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          expires_at?: string;
          created_at?: string;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: 'user' | 'admin' | 'moderator';
      image_layout: 'grid' | 'list' | 'compact';
      chain_type: 'solana' | 'ethereum' | 'bnb';
      platform_type: 'pump' | 'bonk' | 'bags' | 'bnb' | 'usd1';
      token_status: 'pending' | 'creating' | 'created' | 'failed';
      transaction_type: 'buy' | 'sell' | 'create';
      transaction_status: 'pending' | 'confirmed' | 'failed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Convenience types
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
export type UserSettingsInsert = Database['public']['Tables']['user_settings']['Insert'];
export type UserSettingsUpdate = Database['public']['Tables']['user_settings']['Update'];

export type WatchedAccount = Database['public']['Tables']['watched_accounts']['Row'];
export type WatchedAccountInsert = Database['public']['Tables']['watched_accounts']['Insert'];

export type WordHighlight = Database['public']['Tables']['word_highlights']['Row'];
export type WordHighlightInsert = Database['public']['Tables']['word_highlights']['Insert'];

export type ContractAddress = Database['public']['Tables']['contract_addresses']['Row'];
export type ContractAddressInsert = Database['public']['Tables']['contract_addresses']['Insert'];

export type Tweet = Database['public']['Tables']['tweets']['Row'];
export type TweetInsert = Database['public']['Tables']['tweets']['Insert'];

export type Token = Database['public']['Tables']['tokens']['Row'];
export type TokenInsert = Database['public']['Tables']['tokens']['Insert'];
export type TokenUpdate = Database['public']['Tables']['tokens']['Update'];

export type TokenTransaction = Database['public']['Tables']['token_transactions']['Row'];
export type TokenTransactionInsert = Database['public']['Tables']['token_transactions']['Insert'];

export type Event = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];

export type Session = Database['public']['Tables']['sessions']['Row'];
export type SessionInsert = Database['public']['Tables']['sessions']['Insert'];

export type PasswordHash = Database['public']['Tables']['password_hashes']['Row'];
export type PasswordHashInsert = Database['public']['Tables']['password_hashes']['Insert'];
