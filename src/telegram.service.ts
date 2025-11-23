import TelegramBot from 'node-telegram-bot-api';
import { EventBus, EventType, eventBus } from './events';
import { AlphaSignalInsert, AlphaSourceType } from './database.types';

export interface TelegramConfig {
  botToken?: string;
  watchedChatIds?: string[];
  enabled: boolean;
  polling?: boolean;
}

export interface TelegramMessageData {
  id: string;
  content: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  chatId: string;
  chatName: string;
  chatType: 'private' | 'group' | 'supergroup' | 'channel';
  createdAt: Date;
  hasMedia: boolean;
  mediaType: string | null;
  mediaUrl: string | null;
  replyToMessageId: string | null;
  forwardFromChat: string | null;
}

/**
 * Telegram monitoring service for alpha signal aggregation
 */
export class TelegramService {
  private bot: TelegramBot | null = null;
  private config: TelegramConfig;
  private eventBus: EventBus;
  private watchedChats: Set<string>;
  private isRunning: boolean = false;
  private onMessageHandler: ((message: TelegramMessageData) => Promise<void>) | null = null;

  constructor(config: TelegramConfig, bus: EventBus = eventBus) {
    this.config = config;
    this.eventBus = bus;
    this.watchedChats = new Set(config.watchedChatIds || []);
  }

  /**
   * Set handler for incoming messages
   */
  onMessage(handler: (message: TelegramMessageData) => Promise<void>): void {
    this.onMessageHandler = handler;
  }

  /**
   * Add chat to watch list
   */
  addWatchedChat(chatId: string): void {
    this.watchedChats.add(chatId);
    console.log(`[Telegram] Added watched chat: ${chatId}`);
  }

  /**
   * Remove chat from watch list
   */
  removeWatchedChat(chatId: string): void {
    this.watchedChats.delete(chatId);
    console.log(`[Telegram] Removed watched chat: ${chatId}`);
  }

  /**
   * Get all watched chats
   */
  getWatchedChats(): string[] {
    return Array.from(this.watchedChats);
  }

  /**
   * Handle incoming Telegram message
   */
  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    // Check if chat is being watched (empty set = watch all)
    const chatIdStr = msg.chat.id.toString();
    if (this.watchedChats.size > 0 && !this.watchedChats.has(chatIdStr)) {
      return;
    }

    // Determine media info
    let hasMedia = false;
    let mediaType: string | null = null;
    let mediaUrl: string | null = null;

    if (msg.photo) {
      hasMedia = true;
      mediaType = 'photo';
      // Get the largest photo
      const largestPhoto = msg.photo[msg.photo.length - 1];
      if (this.bot) {
        try {
          mediaUrl = await this.bot.getFileLink(largestPhoto.file_id);
        } catch (e) {
          console.error('[Telegram] Error getting photo URL:', e);
        }
      }
    } else if (msg.video) {
      hasMedia = true;
      mediaType = 'video';
    } else if (msg.document) {
      hasMedia = true;
      mediaType = 'document';
    } else if (msg.audio) {
      hasMedia = true;
      mediaType = 'audio';
    }

    // Build message data
    const messageData: TelegramMessageData = {
      id: msg.message_id.toString(),
      content: msg.text || msg.caption || '',
      authorId: msg.from?.id.toString() || 'unknown',
      authorUsername: msg.from?.username || 'unknown',
      authorDisplayName: msg.from?.first_name
        ? `${msg.from.first_name}${msg.from.last_name ? ' ' + msg.from.last_name : ''}`
        : msg.from?.username || 'unknown',
      chatId: chatIdStr,
      chatName: msg.chat.title || msg.chat.username || 'Private Chat',
      chatType: msg.chat.type as TelegramMessageData['chatType'],
      createdAt: new Date(msg.date * 1000),
      hasMedia,
      mediaType,
      mediaUrl,
      replyToMessageId: msg.reply_to_message?.message_id?.toString() || null,
      forwardFromChat: msg.forward_from_chat?.title || msg.forward_from?.username || null,
    };

    console.log(`[Telegram] Message from @${messageData.authorUsername} in ${messageData.chatName}`);
    console.log(`  "${messageData.content.substring(0, 100)}${messageData.content.length > 100 ? '...' : ''}"`);

    // Emit event
    this.eventBus.emit(EventType.ALERT_INFO, {
      title: 'Telegram Message',
      message: `@${messageData.authorUsername} in ${messageData.chatName}: ${messageData.content.substring(0, 50)}...`,
      metadata: { source: 'telegram', messageId: messageData.id },
    });

    // Call handler if set
    if (this.onMessageHandler) {
      try {
        await this.onMessageHandler(messageData);
      } catch (error) {
        console.error('[Telegram] Error in message handler:', error);
      }
    }
  }

  /**
   * Handle channel posts
   */
  private async handleChannelPost(msg: TelegramBot.Message): Promise<void> {
    // Channel posts don't have a "from" user, use the channel info instead
    const chatIdStr = msg.chat.id.toString();
    if (this.watchedChats.size > 0 && !this.watchedChats.has(chatIdStr)) {
      return;
    }

    const messageData: TelegramMessageData = {
      id: msg.message_id.toString(),
      content: msg.text || msg.caption || '',
      authorId: chatIdStr,
      authorUsername: msg.chat.username || 'channel',
      authorDisplayName: msg.chat.title || 'Channel',
      chatId: chatIdStr,
      chatName: msg.chat.title || msg.chat.username || 'Channel',
      chatType: 'channel',
      createdAt: new Date(msg.date * 1000),
      hasMedia: !!(msg.photo || msg.video || msg.document || msg.audio),
      mediaType: msg.photo ? 'photo' : msg.video ? 'video' : msg.document ? 'document' : null,
      mediaUrl: null,
      replyToMessageId: null,
      forwardFromChat: msg.forward_from_chat?.title || null,
    };

    console.log(`[Telegram] Channel post in ${messageData.chatName}`);
    console.log(`  "${messageData.content.substring(0, 100)}${messageData.content.length > 100 ? '...' : ''}"`);

    // Emit event
    this.eventBus.emit(EventType.ALERT_INFO, {
      title: 'Telegram Channel Post',
      message: `${messageData.chatName}: ${messageData.content.substring(0, 50)}...`,
      metadata: { source: 'telegram', messageId: messageData.id },
    });

    // Call handler if set
    if (this.onMessageHandler) {
      try {
        await this.onMessageHandler(messageData);
      } catch (error) {
        console.error('[Telegram] Error in channel post handler:', error);
      }
    }
  }

  /**
   * Convert Telegram message to alpha signal format
   */
  static toAlphaSignal(message: TelegramMessageData): AlphaSignalInsert {
    return {
      source: 'telegram' as AlphaSourceType,
      source_id: `${message.chatId}_${message.id}`,
      source_channel: message.chatName,
      source_author: message.authorUsername,
      source_author_id: message.authorId,
      content: message.content,
      content_raw: {
        chatId: message.chatId,
        chatType: message.chatType,
        replyToMessageId: message.replyToMessageId,
        forwardFromChat: message.forwardFromChat,
      },
      has_media: message.hasMedia,
      media_urls: message.mediaUrl ? [message.mediaUrl] : null,
      source_created_at: message.createdAt.toISOString(),
    };
  }

  /**
   * Start the Telegram bot
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[Telegram] Service disabled, skipping start');
      return;
    }

    if (!this.config.botToken) {
      console.log('[Telegram] No bot token configured, skipping start');
      return;
    }

    console.log('[Telegram] Starting Telegram service...');

    try {
      // Create bot instance
      this.bot = new TelegramBot(this.config.botToken, {
        polling: this.config.polling !== false, // Default to polling
      });

      // Set up message handlers
      this.bot.on('message', async (msg) => {
        await this.handleMessage(msg);
      });

      this.bot.on('channel_post', async (msg) => {
        await this.handleChannelPost(msg);
      });

      // Error handling
      this.bot.on('polling_error', (error) => {
        console.error('[Telegram] Polling error:', error);
        this.eventBus.emit(EventType.SYSTEM_ERROR, {
          source: 'telegram',
          error: error.message,
        });
      });

      this.bot.on('error', (error) => {
        console.error('[Telegram] Error:', error);
        this.eventBus.emit(EventType.SYSTEM_ERROR, {
          source: 'telegram',
          error: error.message,
        });
      });

      // Get bot info
      const botInfo = await this.bot.getMe();
      console.log(`[Telegram] Bot logged in as @${botInfo.username}`);
      this.isRunning = true;

      this.eventBus.emit(EventType.ALERT_SUCCESS, {
        title: 'Telegram Connected',
        message: `Bot logged in as @${botInfo.username}`,
      });
    } catch (error) {
      console.error('[Telegram] Failed to start:', error);
      this.eventBus.emit(EventType.SYSTEM_ERROR, {
        source: 'telegram',
        error: `Failed to start: ${error}`,
      });
      throw error;
    }
  }

  /**
   * Stop the Telegram bot
   */
  async stop(): Promise<void> {
    console.log('[Telegram] Stopping Telegram service...');
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
    this.isRunning = false;
    console.log('[Telegram] Service stopped');
  }

  /**
   * Check if service is running
   */
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get bot info
   */
  async getBotInfo(): Promise<{ username: string; id: number; firstName: string } | null> {
    if (!this.bot) return null;
    try {
      const info = await this.bot.getMe();
      return {
        username: info.username || 'unknown',
        id: info.id,
        firstName: info.first_name,
      };
    } catch (error) {
      console.error('[Telegram] Error getting bot info:', error);
      return null;
    }
  }

  /**
   * Send a message to a chat (for testing/notifications)
   */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.sendMessage(chatId, text);
      return true;
    } catch (error) {
      console.error('[Telegram] Error sending message:', error);
      return false;
    }
  }
}
