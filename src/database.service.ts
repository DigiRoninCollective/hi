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
  // Alpha aggregator types
  WatchedDiscordChannel, WatchedDiscordChannelInsert,
  WatchedTelegramChannel, WatchedTelegramChannelInsert,
  WatchedSubreddit, WatchedSubredditInsert,
  AlphaSignal, AlphaSignalInsert,
  UserAlphaFilter, UserAlphaFilterInsert,
  UserSignalInteraction, UserSignalInteractionInsert,
  AlphaSourceType, AlphaSignalCategory, AlphaSignalPriority,
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

// ============================================
// Alpha Aggregator Operations
// ============================================

// Watched Discord Channels
export async function getWatchedDiscordChannels(userId: string): Promise<WatchedDiscordChannel[]> {
  const { data, error } = await getSupabase()
    .from('watched_discord_channels')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function addWatchedDiscordChannel(channel: WatchedDiscordChannelInsert): Promise<WatchedDiscordChannel | null> {
  const { data, error } = await getSupabase()
    .from('watched_discord_channels')
    .upsert(channel, { onConflict: 'user_id,channel_id' })
    .select()
    .single();

  if (error) {
    console.error('Error adding watched Discord channel:', error);
    return null;
  }
  return data;
}

export async function removeWatchedDiscordChannel(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('watched_discord_channels')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// Watched Telegram Channels
export async function getWatchedTelegramChannels(userId: string): Promise<WatchedTelegramChannel[]> {
  const { data, error } = await getSupabase()
    .from('watched_telegram_channels')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function addWatchedTelegramChannel(channel: WatchedTelegramChannelInsert): Promise<WatchedTelegramChannel | null> {
  const { data, error } = await getSupabase()
    .from('watched_telegram_channels')
    .upsert(channel, { onConflict: 'user_id,chat_id' })
    .select()
    .single();

  if (error) {
    console.error('Error adding watched Telegram channel:', error);
    return null;
  }
  return data;
}

export async function removeWatchedTelegramChannel(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('watched_telegram_channels')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// Watched Subreddits
export async function getWatchedSubreddits(userId: string): Promise<WatchedSubreddit[]> {
  const { data, error } = await getSupabase()
    .from('watched_subreddits')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function addWatchedSubreddit(subreddit: WatchedSubredditInsert): Promise<WatchedSubreddit | null> {
  const { data, error } = await getSupabase()
    .from('watched_subreddits')
    .upsert(subreddit, { onConflict: 'user_id,subreddit' })
    .select()
    .single();

  if (error) {
    console.error('Error adding watched subreddit:', error);
    return null;
  }
  return data;
}

export async function removeWatchedSubreddit(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('watched_subreddits')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// Alpha Signals
export async function saveAlphaSignal(signal: AlphaSignalInsert): Promise<AlphaSignal | null> {
  const { data, error } = await getSupabase()
    .from('alpha_signals')
    .upsert(signal, { onConflict: 'source,source_id' })
    .select()
    .single();

  if (error) {
    console.error('Error saving alpha signal:', error);
    return null;
  }
  return data;
}

export async function getAlphaSignals(options: {
  limit?: number;
  offset?: number;
  source?: AlphaSourceType;
  category?: AlphaSignalCategory;
  minPriority?: AlphaSignalPriority;
  minConfidence?: number;
  maxRisk?: number;
  tickers?: string[];
}): Promise<AlphaSignal[]> {
  let query = getSupabase()
    .from('alpha_signals')
    .select()
    .order('created_at', { ascending: false });

  if (options.source) {
    query = query.eq('source', options.source);
  }
  if (options.category) {
    query = query.eq('category', options.category);
  }
  if (options.minPriority) {
    const priorityOrder = ['low', 'medium', 'high', 'urgent'];
    const minIndex = priorityOrder.indexOf(options.minPriority);
    const validPriorities = priorityOrder.slice(minIndex);
    query = query.in('priority', validPriorities);
  }
  if (options.minConfidence !== undefined) {
    query = query.gte('confidence_score', options.minConfidence);
  }
  if (options.maxRisk !== undefined) {
    query = query.lte('risk_score', options.maxRisk);
  }
  if (options.tickers && options.tickers.length > 0) {
    query = query.overlaps('tickers', options.tickers);
  }

  const limit = options.limit || 100;
  const offset = options.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

export async function getAlphaSignalById(id: string): Promise<AlphaSignal | null> {
  const { data, error } = await getSupabase()
    .from('alpha_signals')
    .select()
    .eq('id', id)
    .single();

  if (error) return null;
  return data;
}

export async function saveAlphaSignalsBatch(signals: AlphaSignalInsert[]): Promise<number> {
  const { data, error } = await getSupabase()
    .from('alpha_signals')
    .upsert(signals, { onConflict: 'source,source_id' })
    .select();

  if (error) {
    console.error('Error saving alpha signals batch:', error);
    return 0;
  }
  return data?.length || 0;
}

// User Alpha Filters
export async function getUserAlphaFilters(userId: string): Promise<UserAlphaFilter[]> {
  const { data, error } = await getSupabase()
    .from('user_alpha_filters')
    .select()
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

export async function createUserAlphaFilter(filter: UserAlphaFilterInsert): Promise<UserAlphaFilter | null> {
  const { data, error } = await getSupabase()
    .from('user_alpha_filters')
    .insert(filter)
    .select()
    .single();

  if (error) {
    console.error('Error creating user alpha filter:', error);
    return null;
  }
  return data;
}

export async function updateUserAlphaFilter(id: string, userId: string, updates: Partial<UserAlphaFilterInsert>): Promise<UserAlphaFilter | null> {
  const { data, error } = await getSupabase()
    .from('user_alpha_filters')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user alpha filter:', error);
    return null;
  }
  return data;
}

export async function deleteUserAlphaFilter(id: string, userId: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('user_alpha_filters')
    .update({ is_active: false })
    .eq('id', id)
    .eq('user_id', userId);

  return !error;
}

// User Signal Interactions
export async function addSignalInteraction(interaction: UserSignalInteractionInsert): Promise<UserSignalInteraction | null> {
  const { data, error } = await getSupabase()
    .from('user_signal_interactions')
    .upsert(interaction, { onConflict: 'user_id,signal_id,interaction_type' })
    .select()
    .single();

  if (error) {
    console.error('Error adding signal interaction:', error);
    return null;
  }
  return data;
}

export async function removeSignalInteraction(userId: string, signalId: string, interactionType: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('user_signal_interactions')
    .delete()
    .eq('user_id', userId)
    .eq('signal_id', signalId)
    .eq('interaction_type', interactionType);

  return !error;
}

export async function getUserSignalInteractions(userId: string, interactionType?: string): Promise<UserSignalInteraction[]> {
  let query = getSupabase()
    .from('user_signal_interactions')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (interactionType) {
    query = query.eq('interaction_type', interactionType);
  }

  const { data, error } = await query;
  if (error) return [];
  return data || [];
}

// Alpha Signal Statistics
export async function getAlphaSignalStats(): Promise<{
  total: number;
  bySource: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  last24h: number;
}> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Total count
  const { count: total } = await getSupabase()
    .from('alpha_signals')
    .select('*', { count: 'exact', head: true });

  // Last 24h count
  const { count: last24h } = await getSupabase()
    .from('alpha_signals')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', yesterday.toISOString());

  // Get sample for category/source breakdown
  const { data: samples } = await getSupabase()
    .from('alpha_signals')
    .select('source, category, priority')
    .limit(1000);

  const bySource: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byPriority: Record<string, number> = {};

  if (samples) {
    for (const s of samples) {
      bySource[s.source] = (bySource[s.source] || 0) + 1;
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      byPriority[s.priority] = (byPriority[s.priority] || 0) + 1;
    }
  }

  return {
    total: total || 0,
    bySource,
    byCategory,
    byPriority,
    last24h: last24h || 0,
  };
}
