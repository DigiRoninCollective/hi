-- J7 Monitor and Deployer - Initial Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
CREATE TYPE image_layout AS ENUM ('grid', 'list', 'compact');
CREATE TYPE chain_type AS ENUM ('solana', 'ethereum', 'bnb');
CREATE TYPE platform_type AS ENUM ('pump', 'bonk', 'bags', 'bnb', 'usd1');
CREATE TYPE token_status AS ENUM ('pending', 'creating', 'created', 'failed');
CREATE TYPE transaction_type AS ENUM ('buy', 'sell', 'create');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    role user_role NOT NULL DEFAULT 'user'
);

-- Password hashes (separate table for security)
CREATE TABLE password_hashes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hash VARCHAR(256) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- User settings
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color_theme VARCHAR(50) NOT NULL DEFAULT 'Default',
    image_layout image_layout NOT NULL DEFAULT 'grid',
    card_width INTEGER NOT NULL DEFAULT 1200,
    pause_on_hover BOOLEAN NOT NULL DEFAULT true,
    sounds_enabled BOOLEAN NOT NULL DEFAULT true,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Sessions for authentication
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Watched Twitter accounts
CREATE TABLE watched_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    twitter_username VARCHAR(50) NOT NULL,
    twitter_user_id VARCHAR(30),
    display_name VARCHAR(100),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Word highlighting rules
CREATE TABLE word_highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#22c55e',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contract addresses to monitor
CREATE TABLE contract_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(100) NOT NULL,
    label VARCHAR(100),
    chain chain_type NOT NULL DEFAULT 'solana',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tweets storage
CREATE TABLE tweets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tweet_id VARCHAR(30) UNIQUE NOT NULL,
    author_username VARCHAR(50) NOT NULL,
    author_display_name VARCHAR(100),
    author_avatar_url TEXT,
    content TEXT NOT NULL,
    media_urls JSONB,
    tweet_url TEXT,
    is_retweet BOOLEAN NOT NULL DEFAULT false,
    original_author VARCHAR(50),
    classification JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tokens created through the platform
CREATE TABLE tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mint_address VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    description TEXT,
    image_url TEXT,
    metadata_uri TEXT,
    platform platform_type NOT NULL DEFAULT 'pump',
    chain chain_type NOT NULL DEFAULT 'solana',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    source_tweet_id VARCHAR(30),
    initial_buy_sol DECIMAL(18, 9),
    signature VARCHAR(128),
    status token_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token transactions
CREATE TABLE token_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type transaction_type NOT NULL,
    amount_sol DECIMAL(18, 9) NOT NULL,
    amount_tokens DECIMAL(18, 9),
    signature VARCHAR(128) NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events log
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_watched_accounts_user_id ON watched_accounts(user_id);
CREATE INDEX idx_word_highlights_user_id ON word_highlights(user_id);
CREATE INDEX idx_contract_addresses_user_id ON contract_addresses(user_id);
CREATE INDEX idx_tweets_tweet_id ON tweets(tweet_id);
CREATE INDEX idx_tweets_author ON tweets(author_username);
CREATE INDEX idx_tweets_created_at ON tweets(created_at DESC);
CREATE INDEX idx_tokens_mint ON tokens(mint_address);
CREATE INDEX idx_tokens_created_by ON tokens(created_by);
CREATE INDEX idx_tokens_status ON tokens(status);
CREATE INDEX idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX idx_token_transactions_token_id ON token_transactions(token_id);
CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policies for service role (full access)
-- These policies allow the service role to access all data

-- Users policies
CREATE POLICY "Service role full access to users" ON users
    FOR ALL USING (true);

CREATE POLICY "Service role full access to password_hashes" ON password_hashes
    FOR ALL USING (true);

CREATE POLICY "Service role full access to user_settings" ON user_settings
    FOR ALL USING (true);

CREATE POLICY "Service role full access to sessions" ON sessions
    FOR ALL USING (true);

CREATE POLICY "Service role full access to watched_accounts" ON watched_accounts
    FOR ALL USING (true);

CREATE POLICY "Service role full access to word_highlights" ON word_highlights
    FOR ALL USING (true);

CREATE POLICY "Service role full access to contract_addresses" ON contract_addresses
    FOR ALL USING (true);

CREATE POLICY "Service role full access to tweets" ON tweets
    FOR ALL USING (true);

CREATE POLICY "Service role full access to tokens" ON tokens
    FOR ALL USING (true);

CREATE POLICY "Service role full access to token_transactions" ON token_transactions
    FOR ALL USING (true);

CREATE POLICY "Service role full access to events" ON events
    FOR ALL USING (true);

-- Grant permissions to authenticated role for anon key
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Optionally create an initial admin user (change credentials before running!)
-- INSERT INTO users (username, email, role) VALUES ('admin', 'admin@example.com', 'admin');
