import { getSupabase } from './supabase';
import {
  User, UserInsert, UserUpdate,
  UserSettings, UserSettingsInsert, UserSettingsUpdate,
  WatchedAccount, WatchedAccountInsert,
  WordHighlight, WordHighlightInsert,
  ContractAddress, ContractAddressInsert,
  Tweet, TweetInsert,
  Token, TokenInsert, TokenUpdate,
  TokenTransaction, TokenTransactionInsert,
  Event, EventInsert,
  Json,
} from './database.types';

// User operations
export async function createUser(user: UserInsert): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .insert(user)
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }
  return data;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .select()
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .select()
    .eq('username', username)
    .single();

  if (error) return null;
  return data;
}

export async function updateUser(id: string, updates: UserUpdate): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    return null;
  }
  return data;
}

// User Settings operations
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await getSupabase()
    .from('user_settings')
    .select()
    .eq('user_id', userId)
    .single();

  if (error) return null;
  return data;
}

export async function createUserSettings(settings: UserSettingsInsert): Promise<UserSettings | null> {
  const { data, error } = await getSupabase()
    .from('user_settings')
    .insert(settings)
    .select()
    .single();

  if (error) {
    console.error('Error creating user settings:', error);
    return null;
  }
  return data;
}

export async function updateUserSettings(userId: string, updates: UserSettingsUpdate): Promise<UserSettings | null> {
  const { data, error } = await getSupabase()
    .from('user_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user settings:', error);
    return null;
  }
  return data;
}

export async function upsertUserSettings(userId: string, settings: Partial<UserSettingsInsert>): Promise<UserSettings | null> {
  const existing = await getUserSettings(userId);
  if (existing) {
    return updateUserSettings(userId, settings);
  }
  return createUserSettings({ user_id: userId, ...settings });
}

// Watched Accounts operations
export async function getWatchedAccounts(userId: string): Promise<WatchedAccount[]> {
  const { data, error } = await getSupabase()
    .from('watched_accounts')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function addWatchedAccount(account: WatchedAccountInsert): Promise<WatchedAccount | null> {
  const { data, error } = await getSupabase()
    .from('watched_accounts')
    .insert(account)
    .select()
    .single();

  if (error) {
    console.error('Error adding watched account:', error);
    return null;
  }
  return data;
}

export async function removeWatchedAccount(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('watched_accounts')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// Word Highlights operations
export async function getWordHighlights(userId: string): Promise<WordHighlight[]> {
  const { data, error } = await getSupabase()
    .from('word_highlights')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function addWordHighlight(highlight: WordHighlightInsert): Promise<WordHighlight | null> {
  const { data, error } = await getSupabase()
    .from('word_highlights')
    .insert(highlight)
    .select()
    .single();

  if (error) {
    console.error('Error adding word highlight:', error);
    return null;
  }
  return data;
}

export async function removeWordHighlight(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('word_highlights')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// Contract Addresses operations
export async function getContractAddresses(userId: string): Promise<ContractAddress[]> {
  const { data, error } = await getSupabase()
    .from('contract_addresses')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function addContractAddress(contract: ContractAddressInsert): Promise<ContractAddress | null> {
  const { data, error } = await getSupabase()
    .from('contract_addresses')
    .insert(contract)
    .select()
    .single();

  if (error) {
    console.error('Error adding contract address:', error);
    return null;
  }
  return data;
}

export async function removeContractAddress(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('contract_addresses')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// Tweet operations
export async function saveTweet(tweet: TweetInsert): Promise<Tweet | null> {
  const { data, error } = await getSupabase()
    .from('tweets')
    .upsert(tweet, { onConflict: 'tweet_id' })
    .select()
    .single();

  if (error) {
    console.error('Error saving tweet:', error);
    return null;
  }
  return data;
}

export async function getTweets(limit: number = 100, offset: number = 0): Promise<Tweet[]> {
  const { data, error } = await getSupabase()
    .from('tweets')
    .select()
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return [];
  return data || [];
}

export async function getTweetById(tweetId: string): Promise<Tweet | null> {
  const { data, error } = await getSupabase()
    .from('tweets')
    .select()
    .eq('tweet_id', tweetId)
    .single();

  if (error) return null;
  return data;
}

// Token operations
export async function createToken(token: TokenInsert): Promise<Token | null> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .insert(token)
    .select()
    .single();

  if (error) {
    console.error('Error creating token:', error);
    return null;
  }
  return data;
}

export async function getTokenByMint(mintAddress: string): Promise<Token | null> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .select()
    .eq('mint_address', mintAddress)
    .single();

  if (error) return null;
  return data;
}

export async function getTokens(limit: number = 50, offset: number = 0, userId?: string): Promise<Token[]> {
  let query = getSupabase()
    .from('tokens')
    .select()
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq('created_by', userId);
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export async function updateToken(mintAddress: string, updates: TokenUpdate): Promise<Token | null> {
  const { data, error } = await getSupabase()
    .from('tokens')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('mint_address', mintAddress)
    .select()
    .single();

  if (error) {
    console.error('Error updating token:', error);
    return null;
  }
  return data;
}

export async function getTokenStats(): Promise<{ total: number; successful: number; failed: number }> {
  const { count: total } = await getSupabase()
    .from('tokens')
    .select('*', { count: 'exact', head: true });

  const { count: successful } = await getSupabase()
    .from('tokens')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'created');

  const { count: failed } = await getSupabase()
    .from('tokens')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  return {
    total: total || 0,
    successful: successful || 0,
    failed: failed || 0,
  };
}

// Token Transaction operations
export async function createTokenTransaction(tx: TokenTransactionInsert): Promise<TokenTransaction | null> {
  const { data, error } = await getSupabase()
    .from('token_transactions')
    .insert(tx)
    .select()
    .single();

  if (error) {
    console.error('Error creating token transaction:', error);
    return null;
  }
  return data;
}

export async function getTokenTransactions(tokenId: string): Promise<TokenTransaction[]> {
  const { data, error } = await getSupabase()
    .from('token_transactions')
    .select()
    .eq('token_id', tokenId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

// Event operations
export async function saveEvent(event: EventInsert): Promise<Event | null> {
  const { data, error } = await getSupabase()
    .from('events')
    .insert(event)
    .select()
    .single();

  if (error) {
    console.error('Error saving event:', error);
    return null;
  }
  return data;
}

export async function getEvents(limit: number = 100, type?: string): Promise<Event[]> {
  let query = getSupabase()
    .from('events')
    .select()
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// Batch operations for efficiency
export async function saveTweetsBatch(tweets: TweetInsert[]): Promise<number> {
  const { data, error } = await getSupabase()
    .from('tweets')
    .upsert(tweets, { onConflict: 'tweet_id' })
    .select();

  if (error) {
    console.error('Error saving tweets batch:', error);
    return 0;
  }
  return data?.length || 0;
}

export async function saveEventsBatch(events: EventInsert[]): Promise<number> {
  const { data, error } = await getSupabase()
    .from('events')
    .insert(events)
    .select();

  if (error) {
    console.error('Error saving events batch:', error);
    return 0;
  }
  return data?.length || 0;
}
