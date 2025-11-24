-- Alpha Aggregator - Multi-source signal aggregation (Discord, Telegram, Reddit)
-- Run this in your Supabase SQL Editor after 001_initial_schema.sql

-- Create custom types for alpha sources
CREATE TYPE alpha_source_type AS ENUM ('discord', 'telegram', 'reddit', 'twitter');
CREATE TYPE alpha_signal_category AS ENUM ('token_mention', 'launch_alert', 'whale_movement', 'news', 'sentiment', 'technical', 'other');
CREATE TYPE alpha_signal_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Watched Discord channels
CREATE TABLE watched_discord_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id VARCHAR(30) NOT NULL,
    guild_name VARCHAR(100),
    channel_id VARCHAR(30) NOT NULL,
    channel_name VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, channel_id)
);

-- Watched Telegram channels/groups
CREATE TABLE watched_telegram_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id VARCHAR(30) NOT NULL,
    chat_name VARCHAR(100),
    chat_type VARCHAR(20) NOT NULL DEFAULT 'channel', -- channel, group, supergroup
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, chat_id)
);

-- Watched Reddit subreddits
CREATE TABLE watched_subreddits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subreddit VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, subreddit)
);

-- Alpha signals - unified table for all sources
CREATE TABLE alpha_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source alpha_source_type NOT NULL,
    source_id VARCHAR(100) NOT NULL, -- Original message/post ID from the source
    source_channel VARCHAR(100), -- Channel/subreddit/group name
    source_author VARCHAR(100),
    source_author_id VARCHAR(100),
    content TEXT NOT NULL,
    content_raw JSONB, -- Raw message data from source

    -- Classification
    category alpha_signal_category NOT NULL DEFAULT 'other',
    priority alpha_signal_priority NOT NULL DEFAULT 'medium',
    confidence_score DECIMAL(5, 4) NOT NULL DEFAULT 0.5,
    risk_score DECIMAL(5, 4) NOT NULL DEFAULT 0.5,

    -- Extracted data
    tickers TEXT[], -- Extracted ticker symbols
    contract_addresses TEXT[], -- Extracted contract addresses
    urls TEXT[], -- Extracted URLs
    mentions TEXT[], -- Mentioned users/accounts

    -- Metadata
    sentiment VARCHAR(20), -- positive, negative, neutral
    language VARCHAR(10) DEFAULT 'en',
    has_media BOOLEAN NOT NULL DEFAULT false,
    media_urls JSONB,

    -- Engagement metrics (if available)
    engagement_score INTEGER DEFAULT 0,
    reaction_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,

    -- Timestamps
    source_created_at TIMESTAMPTZ, -- When the original message was created
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source, source_id)
);

-- User alpha filters - custom filters per user
CREATE TABLE user_alpha_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,

    -- Filter criteria
    sources alpha_source_type[], -- null = all sources
    categories alpha_signal_category[],
    min_confidence DECIMAL(5, 4) DEFAULT 0.5,
    max_risk DECIMAL(5, 4) DEFAULT 1.0,
    min_priority alpha_signal_priority DEFAULT 'low',

    -- Keyword filters
    include_keywords TEXT[],
    exclude_keywords TEXT[],
    include_tickers TEXT[],

    -- Notification settings
    notify_enabled BOOLEAN NOT NULL DEFAULT true,
    notify_channels JSONB, -- {discord: true, telegram: false, push: true}

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User signal interactions (likes, saves, hides)
CREATE TABLE user_signal_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signal_id UUID NOT NULL REFERENCES alpha_signals(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL, -- 'like', 'save', 'hide', 'report'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, signal_id, interaction_type)
);

-- Alpha source credentials (encrypted bot tokens, etc.)
CREATE TABLE alpha_source_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, -- null = system-wide
    source alpha_source_type NOT NULL,
    credential_type VARCHAR(50) NOT NULL, -- 'bot_token', 'api_key', 'oauth_token'
    credential_value TEXT NOT NULL, -- Should be encrypted in production
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_watched_discord_user ON watched_discord_channels(user_id);
CREATE INDEX idx_watched_discord_channel ON watched_discord_channels(channel_id);
CREATE INDEX idx_watched_telegram_user ON watched_telegram_channels(user_id);
CREATE INDEX idx_watched_telegram_chat ON watched_telegram_channels(chat_id);
CREATE INDEX idx_watched_subreddits_user ON watched_subreddits(user_id);
CREATE INDEX idx_watched_subreddits_name ON watched_subreddits(subreddit);

CREATE INDEX idx_alpha_signals_source ON alpha_signals(source);
CREATE INDEX idx_alpha_signals_category ON alpha_signals(category);
CREATE INDEX idx_alpha_signals_priority ON alpha_signals(priority);
CREATE INDEX idx_alpha_signals_created ON alpha_signals(created_at DESC);
CREATE INDEX idx_alpha_signals_confidence ON alpha_signals(confidence_score DESC);
CREATE INDEX idx_alpha_signals_tickers ON alpha_signals USING GIN(tickers);
CREATE INDEX idx_alpha_signals_source_created ON alpha_signals(source_created_at DESC);

CREATE INDEX idx_user_alpha_filters_user ON user_alpha_filters(user_id);
CREATE INDEX idx_user_signal_interactions_user ON user_signal_interactions(user_id);
CREATE INDEX idx_user_signal_interactions_signal ON user_signal_interactions(signal_id);

-- Enable Row Level Security
ALTER TABLE watched_discord_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_telegram_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_subreddits ENABLE ROW LEVEL SECURITY;
ALTER TABLE alpha_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alpha_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_signal_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alpha_source_credentials ENABLE ROW LEVEL SECURITY;

-- Create policies for service role
CREATE POLICY "Service role full access to watched_discord_channels" ON watched_discord_channels
    FOR ALL USING (true);

CREATE POLICY "Service role full access to watched_telegram_channels" ON watched_telegram_channels
    FOR ALL USING (true);

CREATE POLICY "Service role full access to watched_subreddits" ON watched_subreddits
    FOR ALL USING (true);

CREATE POLICY "Service role full access to alpha_signals" ON alpha_signals
    FOR ALL USING (true);

CREATE POLICY "Service role full access to user_alpha_filters" ON user_alpha_filters
    FOR ALL USING (true);

CREATE POLICY "Service role full access to user_signal_interactions" ON user_signal_interactions
    FOR ALL USING (true);

CREATE POLICY "Service role full access to alpha_source_credentials" ON alpha_source_credentials
    FOR ALL USING (true);

-- Updated_at trigger for user_alpha_filters
CREATE TRIGGER update_user_alpha_filters_updated_at
    BEFORE UPDATE ON user_alpha_filters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Updated_at trigger for alpha_source_credentials
CREATE TRIGGER update_alpha_source_credentials_updated_at
    BEFORE UPDATE ON alpha_source_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
