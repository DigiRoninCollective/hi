import { Client, GatewayIntentBits, Message, PartialMessage, TextChannel, Events } from 'discord.js';
import { EventBus, EventType, eventBus } from './events';
import { AlphaSignalInsert, AlphaSourceType } from './database.types';

export interface DiscordConfig {
  botToken?: string;
  watchedChannelIds?: string[];
  enabled: boolean;
}

export interface DiscordMessageData {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  channelId: string;
  channelName: string;
  guildId: string | null;
  guildName: string | null;
  createdAt: Date;
  attachments: string[];
  embeds: any[];
  reactionCount: number;
  replyCount: number;
}

// noinspection GrazieInspection
/**
 * Discord monitoring service for alpha signal aggregation
 */
export class DiscordService {
  private client: Client;
  private config: DiscordConfig;
  private eventBus: EventBus;
  private watchedChannels: Set<string>;
  private isConnected: boolean = false;
  private onMessageHandler: ((message: DiscordMessageData) => Promise<void>) | null = null;

  constructor(config: DiscordConfig, bus: EventBus = eventBus) {
    this.config = config;
    this.eventBus = bus;
    this.watchedChannels = new Set(config.watchedChannelIds || []);

    // Initialize Discord client with necessary intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
    });

    this.setupEventHandlers();
  }

  /**
   * Set handler for incoming messages
   */
  onMessage(handler: (message: DiscordMessageData) => Promise<void>): void {
    this.onMessageHandler = handler;
  }

  /**
   * Add channel to watch list
   */
  addWatchedChannel(channelId: string): void {
    this.watchedChannels.add(channelId);
    console.log(`[Discord] Added watched channel: ${channelId}`);
  }

  /**
   * Remove channel from watch list
   */
  removeWatchedChannel(channelId: string): void {
    this.watchedChannels.delete(channelId);
    console.log(`[Discord] Removed watched channel: ${channelId}`);
  }

  /**
   * Get all watched channels
   */
  getWatchedChannels(): string[] {
    return Array.from(this.watchedChannels);
  }

  /**
   * Set up Discord event handlers
   */
  private setupEventHandlers(): void {
    // Ready event
    this.client.on(Events.ClientReady, (client) => {
      console.log(`[Discord] Bot logged in as ${client.user.tag}`);
      this.isConnected = true;

      this.eventBus.emit(EventType.ALERT_SUCCESS, {
        title: 'Discord Connected',
        message: `Bot logged in as ${client.user.tag}`,
      });

      // Log guilds the bot is in
      console.log(`[Discord] Connected to ${client.guilds.cache.size} guild(s)`);
      client.guilds.cache.forEach((guild) => {
        console.log(`  - ${guild.name} (${guild.id})`);
      });
    });

    // Message create event
    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });

    // Message update event (for edits)
    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      if (newMessage.partial) {
        try {
          await newMessage.fetch();
        } catch (error) {
          console.error('[Discord] Error fetching updated message:', error);
          return;
        }
      }
      await this.handleMessage(newMessage as Message);
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      console.error('[Discord] Client error:', error);
      this.eventBus.emit(EventType.SYSTEM_ERROR, {
        source: 'discord',
        error: error.message,
      });
    });

    // Disconnection handling
    this.client.on(Events.ShardDisconnect, () => {
      console.log('[Discord] Disconnected from Discord');
      this.isConnected = false;
    });

    // Reconnection
    this.client.on(Events.ShardReconnecting, () => {
      console.log('[Discord] Reconnecting to Discord...');
    });
  }

  /**
   * Handle incoming Discord message
   */
  private async handleMessage(message: Message | PartialMessage): Promise<void> {
    // Ignore bot messages
    if (message.author?.bot) return;

    // Check if channel is being watched (empty set = watch all)
    if (this.watchedChannels.size > 0 && !this.watchedChannels.has(message.channelId)) {
      return;
    }

    // Get channel info
    const channel = message.channel;
    // Not all channel types have a name (e.g., DMs)
    const channelName = (channel as any)?.name || 'direct-message';

    // Build message data
    const messageData: DiscordMessageData = {
      id: message.id,
      content: message.content || '',
      authorId: message.author?.id || 'unknown',
      authorUsername: message.author?.username || 'unknown',
      authorDisplayName: message.author?.displayName || message.author?.username || 'unknown',
      channelId: message.channelId,
      channelName,
      guildId: message.guildId,
      guildName: message.guild?.name || null,
      createdAt: message.createdAt || new Date(),
      attachments: message.attachments?.map((a) => a.url) || [],
      embeds: message.embeds?.map((e) => e.toJSON()) || [],
      reactionCount: message.reactions?.cache.reduce((sum, r) => sum + (r.count || 0), 0) || 0,
      replyCount: 0, // Discord doesn't provide this directly
    };

    console.log(`[Discord] Message from @${messageData.authorUsername} in #${messageData.channelName}`);
    console.log(`  "${messageData.content.substring(0, 100)}${messageData.content.length > 100 ? '...' : ''}"`);

    // Emit event
    this.eventBus.emit(EventType.ALERT_INFO, {
      title: 'Discord Message',
      message: `@${messageData.authorUsername} in #${messageData.channelName}: ${messageData.content.substring(0, 50)}...`,
      metadata: { source: 'discord', messageId: messageData.id },
    });

    // Call handler if set
    if (this.onMessageHandler) {
      try {
        await this.onMessageHandler(messageData);
      } catch (error) {
        console.error('[Discord] Error in message handler:', error);
      }
    }
  }

  /**
   * Convert Discord message to alpha signal format
   */
  static toAlphaSignal(message: DiscordMessageData): AlphaSignalInsert {
    return {
      source: 'discord' as AlphaSourceType,
      source_id: message.id,
      source_channel: `${message.guildName || 'DM'}/#${message.channelName}`,
      source_author: message.authorUsername,
      source_author_id: message.authorId,
      content: message.content,
      content_raw: {
        embeds: message.embeds,
        attachments: message.attachments,
        guildId: message.guildId,
        channelId: message.channelId,
      },
      has_media: message.attachments.length > 0 || message.embeds.length > 0,
      media_urls: message.attachments.length > 0 ? message.attachments : null,
      reaction_count: message.reactionCount,
      reply_count: message.replyCount,
      source_created_at: message.createdAt.toISOString(),
    };
  }

  /**
   * Start the Discord bot
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Discord] Service disabled, skipping start');
      return;
    }

    if (!this.config.botToken) {
      console.log('[Discord] No bot token configured, skipping start');
      return;
    }

    console.log('[Discord] Starting Discord service...');

    try {
      await this.client.login(this.config.botToken);
      console.log('[Discord] Login initiated');
    } catch (error) {
      console.error('[Discord] Failed to login:', error);
      this.eventBus.emit(EventType.SYSTEM_ERROR, {
        source: 'discord',
        error: `Failed to login: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Stop the Discord bot
   */
  async stop(): Promise<void> {
    console.log('[Discord] Stopping Discord service...');
    this.client.destroy();
    this.isConnected = false;
    console.log('[Discord] Service stopped');
  }

  /**
   * Check if service is connected
   */
  isServiceConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get bot info
   */
  getBotInfo(): { username: string; id: string; guilds: number } | null {
    if (!this.client.user) return null;
    return {
      username: this.client.user.username,
      id: this.client.user.id,
      guilds: this.client.guilds.cache.size,
    };
  }

  /**
   * List available guilds and channels
   */
  getAvailableChannels(): { guildId: string; guildName: string; channels: { id: string; name: string }[] }[] {
    const result: { guildId: string; guildName: string; channels: { id: string; name: string }[] }[] = [];

    this.client.guilds.cache.forEach((guild) => {
      const channels: { id: string; name: string }[] = [];
      guild.channels.cache.forEach((channel) => {
        if (channel instanceof TextChannel) {
          channels.push({ id: channel.id, name: channel.name });
        }
      });
      result.push({
        guildId: guild.id,
        guildName: guild.name,
        channels,
      });
    });

    return result;
  }
}
