-- Create mint_keys table for managing mint keypair persistence and recovery
CREATE TABLE public.mint_keys (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT UNIQUE NOT NULL,
  secret_key_bs58 TEXT NOT NULL,
  token_name TEXT,
  token_symbol TEXT,
  contract_address TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  creation_signature TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  error_message TEXT,
  failed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for faster queries
CREATE INDEX mint_keys_status_idx ON mint_keys(status);
CREATE INDEX mint_keys_created_by_idx ON mint_keys(created_by);
CREATE INDEX mint_keys_created_at_idx ON mint_keys(created_at DESC);

-- Enable Row Level Security
ALTER TABLE mint_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can view their own mint keys
CREATE POLICY "Users can view own mint keys"
  ON mint_keys FOR SELECT
  USING (created_by = auth.uid()::text);

-- RLS Policy 2: Users can create mint keys for themselves
CREATE POLICY "Users can create own mint keys"
  ON mint_keys FOR INSERT
  WITH CHECK (created_by = auth.uid()::text);

-- RLS Policy 3: Users can update their own mint keys
CREATE POLICY "Users can update own mint keys"
  ON mint_keys FOR UPDATE
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- RLS Policy 4: Users can delete their own mint keys
CREATE POLICY "Users can delete own mint keys"
  ON mint_keys FOR DELETE
  USING (created_by = auth.uid()::text);
