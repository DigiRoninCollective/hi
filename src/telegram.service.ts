import TelegramBot, { Message as TelegramRawMessage, CallbackQuery as TelegramCallbackQuery, InlineKeyboardButton as TelegramInlineKeyboardButton, InlineKeyboardMarkup as TelegramInlineKeyboardMarkup } from 'node-telegram-bot-api';

type InlineKeyboardButton = TelegramInlineKeyboardButton;
type InlineKeyboardMarkup = TelegramInlineKeyboardMarkup;
type CallbackQuery = TelegramCallbackQuery;

// Message type from Telegram
interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
  };
  date: number;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; file_unique_id: string; width: number; height: number }>;
  video?: { file_id: string };
  document?: { file_id: string };
  audio?: { file_id: string };
  reply_to_message?: { message_id: number };
  forward_from_chat?: { title?: string };
  forward_from?: { username?: string };
}
import { EventBus, EventType, eventBus } from './events';
import { AlphaSignalInsert, AlphaSourceType } from './database.types';
import fetch from 'node-fetch';

export interface TelegramConfig {
  botToken?: string;
  watchedChatIds?: string[];
  enabled: boolean;
  polling?: boolean;
  botName?: string;
  botDescription?: string;
  launchApiUrl?: string;
  launchApiKey?: string;
  defaultLaunchAmount?: number;
}

// User subscription preferences
export interface UserSubscription {
  chatId: string;
  userId: string;
  username: string;
  subscribedAt: Date;
  alertTypes: {
    tokenLaunches: boolean;
    highPrioritySignals: boolean;
    systemAlerts: boolean;
  };
  isActive: boolean;
}

// Button callback data types
export type CallbackAction =
  | 'subscribe'
  | 'unsubscribe'
  | 'settings'
  | 'help'
  | 'status'
  | 'launch'
  | 'toggle_launches'
  | 'toggle_signals'
  | 'toggle_system'
  | 'back_main';

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
  private bot: InstanceType<typeof TelegramBot> | null = null;
  private config: TelegramConfig;
  private eventBus: EventBus;
  private watchedChats: Set<string>;
  private isRunning: boolean = false;
  private onMessageHandler: ((message: TelegramMessageData) => Promise<void>) | null = null;
  private subscriptions: Map<string, UserSubscription> = new Map();
  private botUsername: string = '';
  private launchApiUrl?: string;
  private launchApiKey?: string;
  private defaultLaunchAmount: number;

  constructor(config: TelegramConfig, bus: EventBus = eventBus) {
    this.config = config;
    this.eventBus = bus;
    this.watchedChats = new Set(config.watchedChatIds || []);
    this.launchApiUrl = config.launchApiUrl;
    this.launchApiKey = config.launchApiKey;
    this.defaultLaunchAmount = config.defaultLaunchAmount ?? 0.1;
  }

  // ============================================
  // INLINE KEYBOARD BUILDERS
  // ============================================

  /**
   * Create the main menu keyboard
   */
  private createMainMenuKeyboard(): InlineKeyboardMarkup {
    return {
      inline_keyboard: [
        [
          { text: '🚀 Launch', callback_data: 'launch' },
          { text: '🔔 Subscribe', callback_data: 'subscribe' },
          { text: '🔕 Unsubscribe', callback_data: 'unsubscribe' },
        ],
        [
          { text: '⚙️ Settings', callback_data: 'settings' },
          { text: '📊 Status', callback_data: 'status' },
        ],
        [
          { text: '❓ Help', callback_data: 'help' },
        ],
      ],
    };
  }

  /**
   * Create settings menu keyboard
   */
  private createSettingsKeyboard(subscription: UserSubscription | undefined): InlineKeyboardMarkup {
    const launches = subscription?.alertTypes.tokenLaunches ?? true;
    const signals = subscription?.alertTypes.highPrioritySignals ?? true;
    const system = subscription?.alertTypes.systemAlerts ?? false;

    return {
      inline_keyboard: [
        [
          {
            text: `${launches ? '✅' : '❌'} Token Launches`,
            callback_data: 'toggle_launches',
          },
        ],
        [
          {
            text: `${signals ? '✅' : '❌'} High Priority Signals`,
            callback_data: 'toggle_signals',
          },
        ],
        [
          {
            text: `${system ? '✅' : '❌'} System Alerts`,
            callback_data: 'toggle_system',
          },
        ],
        [
          { text: '⬅️ Back to Menu', callback_data: 'back_main' },
        ],
      ],
    };
  }

  // ============================================
  // BOT COMMANDS
  // ============================================

  /**
   * Setup bot commands
   */
  private async setupCommands(): Promise<void> {
    if (!this.bot) return;

    // Set bot commands in Telegram
    await this.bot.setMyCommands([
      { command: 'start', description: 'Start the bot and see welcome message' },
      { command: 'help', description: 'Get help and command list' },
      { command: 'status', description: 'Check bot and service status' },
      { command: 'subscribe', description: 'Subscribe to alerts' },
      { command: 'unsubscribe', description: 'Unsubscribe from alerts' },
      { command: 'settings', description: 'Manage your notification settings' },
      { command: 'launch', description: 'Launch a token (manual trigger)' },
    ]);

    // Register command handlers
    this.bot.onText(/\/start/, (msg: TelegramMessage): Promise<void> => this.handleStartCommand(msg));
    this.bot.onText(/\/help/, (msg: TelegramMessage): Promise<void> => this.handleHelpCommand(msg));
    this.bot.onText(/\/status/, (msg: TelegramMessage): Promise<void> => this.handleStatusCommand(msg));
    this.bot.onText(/\/subscribe/, (msg: TelegramMessage): Promise<void> => this.handleSubscribeCommand(msg));
    this.bot.onText(/\/unsubscribe/, (msg: TelegramMessage): Promise<void> => this.handleUnsubscribeCommand(msg));
    this.bot.onText(/\/settings/, (msg: TelegramMessage): Promise<void> => this.handleSettingsCommand(msg));
    this.bot.onText(/\/launch(.*)/, (msg: TelegramMessage, match: string[] | null): Promise<void> =>
      this.handleLaunchCommand(msg, match?.[1] || '')
    );

    // Register callback query handler for buttons
    this.bot.on('callback_query', (query: CallbackQuery): Promise<void> => this.handleCallbackQuery(query));
  }

  /**
   * Handle /start command - Welcome message with introduction
   */
  private async handleStartCommand(msg: TelegramMessage): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;
    const username = msg.from?.username || msg.from?.first_name || 'there';
    const botName = this.config.botName || 'Alpha Signal Bot';

    const welcomeMessage = `
🚀 *Welcome to ${botName}!*

Hey @${username}! I'm your personal crypto alpha aggregator bot.

*What I do:*
• 📡 Monitor multiple sources for trading signals
• 🎯 Detect token launches and opportunities
• 🔔 Send real-time alerts to subscribers
• 📊 Track and classify alpha from Discord, Telegram, Reddit & Twitter

*Quick Start:*
1️⃣ Hit *Subscribe* to start receiving alerts
2️⃣ Go to *Settings* to customize what you receive
3️⃣ Check *Status* to see what's being monitored

Use the buttons below or type /help for commands.
    `.trim();

    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  /**
   * Handle /help command
   */
  private async handleHelpCommand(msg: TelegramMessage): Promise<void> {
    if (!this.bot) return;

    const helpMessage = `
📚 *Available Commands*

/start - Start the bot and see welcome message
/help - Show this help message
/status - Check bot and monitoring status
/subscribe - Subscribe to receive alerts
/unsubscribe - Stop receiving alerts
/settings - Customize your notification preferences

*Alert Types:*
• 🚀 *Token Launches* - New token deployments
• 🎯 *High Priority Signals* - Strong alpha opportunities
• ⚙️ *System Alerts* - Service status updates

*Need Support?*
Visit our GitHub for issues and updates.
    `.trim();

    await this.bot.sendMessage(msg.chat.id, helpMessage, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  /**
   * Handle /status command
   */
  private async handleStatusCommand(msg: TelegramMessage): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id.toString();
    const subscription = this.subscriptions.get(chatId);
    const subscriberCount = this.subscriptions.size;
    const watchedChatsCount = this.watchedChats.size;

    const statusEmoji = this.isRunning ? '🟢' : '🔴';
    const subscriptionStatus = subscription?.isActive ? '✅ Subscribed' : '❌ Not subscribed';

    const statusMessage = `
📊 *Bot Status*

${statusEmoji} *Service:* ${this.isRunning ? 'Online' : 'Offline'}
👤 *Your Status:* ${subscriptionStatus}
📢 *Total Subscribers:* ${subscriberCount}
👁 *Watched Chats:* ${watchedChatsCount}
🤖 *Bot:* @${this.botUsername || 'unknown'}

${subscription?.isActive ? `
*Your Settings:*
• Token Launches: ${subscription.alertTypes.tokenLaunches ? '✅' : '❌'}
• High Priority Signals: ${subscription.alertTypes.highPrioritySignals ? '✅' : '❌'}
• System Alerts: ${subscription.alertTypes.systemAlerts ? '✅' : '❌'}
` : ''}
    `.trim();

    await this.bot.sendMessage(msg.chat.id, statusMessage, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  /**
   * Handle /subscribe command
   */
  private async handleSubscribeCommand(msg: TelegramMessage): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id.toString();
    const userId = msg.from?.id.toString() || 'unknown';
    const username = msg.from?.username || msg.from?.first_name || 'unknown';

    // Create or update subscription
    const existing = this.subscriptions.get(chatId);
    const subscription: UserSubscription = {
      chatId,
      userId,
      username,
      subscribedAt: existing?.subscribedAt || new Date(),
      alertTypes: existing?.alertTypes || {
        tokenLaunches: true,
        highPrioritySignals: true,
        systemAlerts: false,
      },
      isActive: true,
    };

    this.subscriptions.set(chatId, subscription);

    const message = `
🔔 *Subscribed Successfully!*

You're now subscribed to alerts, @${username}!

*Current Settings:*
• Token Launches: ${subscription.alertTypes.tokenLaunches ? '✅' : '❌'}
• High Priority Signals: ${subscription.alertTypes.highPrioritySignals ? '✅' : '❌'}
• System Alerts: ${subscription.alertTypes.systemAlerts ? '✅' : '❌'}

Use /settings to customize what alerts you receive.
    `.trim();

    await this.bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });

    console.log(`[Telegram] User @${username} subscribed (chat: ${chatId})`);
  }

  /**
   * Handle /unsubscribe command
   */
  private async handleUnsubscribeCommand(msg: TelegramMessage): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id.toString();
    const existing = this.subscriptions.get(chatId);

    if (existing) {
      existing.isActive = false;
      this.subscriptions.set(chatId, existing);
    }

    const message = `
🔕 *Unsubscribed*

You've been unsubscribed from alerts.

You can re-subscribe anytime using /subscribe or the button below.
    `.trim();

    await this.bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });

    console.log(`[Telegram] User unsubscribed (chat: ${chatId})`);
  }

  /**
   * Handle /settings command
   */
  private async handleSettingsCommand(msg: TelegramMessage): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id.toString();
    const subscription = this.subscriptions.get(chatId);

    const message = `
⚙️ *Notification Settings*

Tap the buttons below to toggle each alert type.

${!subscription?.isActive ? '⚠️ *Note:* You are currently unsubscribed. Subscribe first to receive alerts.' : ''}
    `.trim();

    await this.bot.sendMessage(msg.chat.id, message, {
      parse_mode: 'Markdown',
      reply_markup: this.createSettingsKeyboard(subscription),
    });
  }

  // ============================================
  // CALLBACK QUERY HANDLER (Button clicks)
  // ============================================

  /**
   * Handle button callback queries
   */
  private async handleCallbackQuery(query: CallbackQuery): Promise<void> {
    if (!this.bot || !query.message || !query.data) return;

    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const action = query.data as CallbackAction;

    // Acknowledge the callback
    await this.bot.answerCallbackQuery(query.id);

    switch (action) {
      case 'subscribe':
        await this.handleSubscribeCallback(chatId, query);
        break;
      case 'unsubscribe':
        await this.handleUnsubscribeCallback(chatId, query);
        break;
      case 'settings':
        await this.handleSettingsCallback(chatId, messageId);
        break;
      case 'help':
        await this.handleHelpCallback(chatId, messageId);
        break;
      case 'status':
        await this.handleStatusCallback(chatId, messageId);
        break;
      case 'launch':
        await this.handleLaunchCallback(chatId);
        break;
      case 'toggle_launches':
      case 'toggle_signals':
      case 'toggle_system':
        await this.handleToggleCallback(chatId, messageId, action);
        break;
      case 'back_main':
        await this.handleBackToMainCallback(chatId, messageId);
        break;
    }
  }

  private async handleSubscribeCallback(chatId: number, query: CallbackQuery): Promise<void> {
    if (!this.bot) return;

    const chatIdStr = chatId.toString();
    const userId = query.from.id.toString();
    const username = query.from.username || query.from.first_name || 'unknown';

    const existing = this.subscriptions.get(chatIdStr);
    const subscription: UserSubscription = {
      chatId: chatIdStr,
      userId,
      username,
      subscribedAt: existing?.subscribedAt || new Date(),
      alertTypes: existing?.alertTypes || {
        tokenLaunches: true,
        highPrioritySignals: true,
        systemAlerts: false,
      },
      isActive: true,
    };

    this.subscriptions.set(chatIdStr, subscription);

    await this.bot.sendMessage(chatId, `🔔 *Subscribed!* You'll now receive alerts.`, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });

    console.log(`[Telegram] User @${username} subscribed via button`);
  }

  private async handleUnsubscribeCallback(chatId: number, query: CallbackQuery): Promise<void> {
    if (!this.bot) return;

    const chatIdStr = chatId.toString();
    const existing = this.subscriptions.get(chatIdStr);

    if (existing) {
      existing.isActive = false;
      this.subscriptions.set(chatIdStr, existing);
    }

    await this.bot.sendMessage(chatId, `🔕 *Unsubscribed.* You won't receive alerts anymore.`, {
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  private async handleSettingsCallback(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    const subscription = this.subscriptions.get(chatId.toString());

    await this.bot.editMessageText(
      `⚙️ *Notification Settings*\n\nTap to toggle each alert type:`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: this.createSettingsKeyboard(subscription),
      }
    );
  }

  private async handleHelpCallback(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    const helpText = `
📚 *Commands*

/start - Welcome & menu
/subscribe - Get alerts
/unsubscribe - Stop alerts
/settings - Alert preferences
/status - Bot status
    `.trim();

    await this.bot.editMessageText(helpText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  private async handleStatusCallback(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    const subscription = this.subscriptions.get(chatId.toString());
    const statusEmoji = this.isRunning ? '🟢' : '🔴';

    const statusText = `
📊 *Status*

${statusEmoji} Service: ${this.isRunning ? 'Online' : 'Offline'}
👤 You: ${subscription?.isActive ? '✅ Subscribed' : '❌ Not subscribed'}
📢 Subscribers: ${this.subscriptions.size}
    `.trim();

    await this.bot.editMessageText(statusText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: this.createMainMenuKeyboard(),
    });
  }

  private async handleToggleCallback(chatId: number, messageId: number, action: string): Promise<void> {
    if (!this.bot) return;

    const chatIdStr = chatId.toString();
    let subscription = this.subscriptions.get(chatIdStr);

    if (!subscription) {
      // Auto-create subscription if toggling settings
      subscription = {
        chatId: chatIdStr,
        userId: 'unknown',
        username: 'unknown',
        subscribedAt: new Date(),
        alertTypes: {
          tokenLaunches: true,
          highPrioritySignals: true,
          systemAlerts: false,
        },
        isActive: true,
      };
    }

    // Toggle the appropriate setting
    switch (action) {
      case 'toggle_launches':
        subscription.alertTypes.tokenLaunches = !subscription.alertTypes.tokenLaunches;
        break;
      case 'toggle_signals':
        subscription.alertTypes.highPrioritySignals = !subscription.alertTypes.highPrioritySignals;
        break;
      case 'toggle_system':
        subscription.alertTypes.systemAlerts = !subscription.alertTypes.systemAlerts;
        break;
    }

    this.subscriptions.set(chatIdStr, subscription);

    // Update the message with new keyboard
    await this.bot.editMessageReplyMarkup(this.createSettingsKeyboard(subscription), {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  private async handleBackToMainCallback(chatId: number, messageId: number): Promise<void> {
    if (!this.bot) return;

    const botName = this.config.botName || 'Alpha Signal Bot';

    await this.bot.editMessageText(
      `🚀 *${botName}*\n\nWhat would you like to do?`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: this.createMainMenuKeyboard(),
      }
    );
  }

  // ============================================
  // LAUNCH COMMAND
  // ============================================

  private async handleLaunchCallback(chatId: number): Promise<void> {
    if (!this.bot) return;
    await this.bot.sendMessage(
      chatId,
      `🚀 *Launch a token*\n\nReply with: /launch SYMBOL Name\nExample: /launch NOVA Nova Token\n\nDefault buy: ${this.defaultLaunchAmount} SOL`,
      { parse_mode: 'Markdown' }
    );
  }

  private async handleLaunchCommand(msg: TelegramMessage, args: string): Promise<void> {
    if (!this.bot) return;

    const chatId = msg.chat.id;
    const text = args?.trim() || '';
    if (!text) {
      await this.handleLaunchCallback(chatId);
      return;
    }

    const parts = text.split(/\s+/);
    const symbol = (parts[0] || '').replace('$', '').toUpperCase();
    const name = parts.slice(1).join(' ') || symbol;

    if (symbol.length < 2 || symbol.length > 10 || !/^[A-Z0-9]+$/.test(symbol)) {
      await this.bot.sendMessage(chatId, '❌ Invalid symbol. Use 2-10 letters/numbers. Example: /launch NOVA Nova Token');
      return;
    }

    await this.bot.sendMessage(chatId, `⏳ Launching *${name}* ($${symbol})...`, { parse_mode: 'Markdown' });

    try {
      await this.launchTokenFromTelegram({ name, symbol, description: `${name} launched via Telegram`, chatId: chatId.toString() });
      await this.bot.sendMessage(
        chatId,
        `✅ Launch requested for *${name}* ($${symbol}). Watch the feed for confirmation.`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.bot.sendMessage(
        chatId,
        `❌ Launch failed: ${errorMessage}`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async launchTokenFromTelegram(input: {
    name: string;
    symbol: string;
    description: string;
    chatId: string;
  }): Promise<void> {
    const url = this.launchApiUrl || 'http://localhost:3000/api/tokens/create';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.launchApiKey) {
      headers['x-api-key'] = this.launchApiKey;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: input.name,
        symbol: input.symbol,
        description: input.description,
        platform: 'pump',
        buyAmount: this.defaultLaunchAmount,
        telegramChatId: input.chatId,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${res.status}: ${text || res.statusText}`);
    }
  }

  // ============================================
  // BROADCAST METHODS
  // ============================================

  /**
   * Broadcast a message to all active subscribers
   */
  async broadcastToSubscribers(
    message: string,
    alertType: 'tokenLaunches' | 'highPrioritySignals' | 'systemAlerts',
    options?: { parseMode?: 'Markdown' | 'HTML' }
  ): Promise<{ sent: number; failed: number }> {
    if (!this.bot) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;

    const entries = Array.from(this.subscriptions.entries());
    for (let i = 0; i < entries.length; i++) {
      const [chatId, subscription] = entries[i];
      if (!subscription.isActive) continue;
      if (!subscription.alertTypes[alertType]) continue;

      try {
        await this.bot.sendMessage(chatId, message, {
          parse_mode: options?.parseMode || 'Markdown',
        });
        sent++;
      } catch (error) {
        console.error(`[Telegram] Failed to send to ${chatId}:`, error);
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Send a token launch alert
   */
  async sendTokenLaunchAlert(tokenData: {
    name: string;
    symbol: string;
    address?: string;
    source: string;
    confidence: number;
  }): Promise<void> {
    const message = `
🚀 *New Token Launch Detected!*

*Name:* ${tokenData.name}
*Symbol:* $${tokenData.symbol}
${tokenData.address ? `*Address:* \`${tokenData.address}\`` : ''}
*Source:* ${tokenData.source}
*Confidence:* ${(tokenData.confidence * 100).toFixed(1)}%

⚠️ DYOR - Not financial advice
    `.trim();

    await this.broadcastToSubscribers(message, 'tokenLaunches');
  }

  /**
   * Send a high priority signal alert
   */
  async sendSignalAlert(signalData: {
    content: string;
    source: string;
    author: string;
    priority: string;
    tickers?: string[];
  }): Promise<void> {
    const tickersStr = signalData.tickers?.length
      ? `\n*Tickers:* ${signalData.tickers.map(t => `$${t}`).join(', ')}`
      : '';

    const message = `
🎯 *High Priority Signal*

*Source:* ${signalData.source}
*Author:* ${signalData.author}
*Priority:* ${signalData.priority}${tickersStr}

${signalData.content.substring(0, 500)}${signalData.content.length > 500 ? '...' : ''}
    `.trim();

    await this.broadcastToSubscribers(message, 'highPrioritySignals');
  }

  // ============================================
  // SUBSCRIPTION GETTERS
  // ============================================

  /**
   * Get all active subscribers
   */
  getActiveSubscribers(): UserSubscription[] {
    return Array.from(this.subscriptions.values()).filter(s => s.isActive);
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.getActiveSubscribers().length;
  }

  /**
   * Check if a chat is subscribed
   */
  isSubscribed(chatId: string): boolean {
    const sub = this.subscriptions.get(chatId);
    return sub?.isActive ?? false;
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
  private async handleMessage(msg: TelegramMessage): Promise<void> {
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

    // Emit events (structured for SSE + alert)
    this.eventBus.emit(EventType.TELEGRAM_MESSAGE, {
      source: 'telegram',
      chatId: messageData.chatId,
      chatName: messageData.chatName,
      author: messageData.authorUsername,
      authorDisplay: messageData.authorDisplayName,
      messageId: messageData.id,
      content: messageData.content,
      createdAt: messageData.createdAt.toISOString(),
      severity: 'info',
      mediaType: messageData.mediaType,
    });
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
  private async handleChannelPost(msg: TelegramMessage): Promise<void> {
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

    // Emit events (structured for SSE + alert)
    this.eventBus.emit(EventType.TELEGRAM_MESSAGE, {
      source: 'telegram',
      chatId: messageData.chatId,
      chatName: messageData.chatName,
      author: messageData.authorUsername,
      authorDisplay: messageData.authorDisplayName,
      messageId: messageData.id,
      content: messageData.content,
      createdAt: messageData.createdAt.toISOString(),
      severity: 'info',
      mediaType: messageData.mediaType,
    });
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

      // Setup bot commands and callbacks first
      await this.setupCommands();
      console.log('[Telegram] Bot commands registered');

      // Set up message handlers for alpha monitoring
      this.bot.on('message', async (msg: any) => {
        // Skip command messages from being processed as alpha signals
        if (msg.text?.startsWith('/')) return;
        await this.handleMessage(msg);
      });

      this.bot.on('channel_post', async (msg: any) => {
        await this.handleChannelPost(msg);
      });

      // Error handling
      this.bot.on('polling_error', (error: any) => {
        console.error('[Telegram] Polling error:', error);
        this.eventBus.emit(EventType.SYSTEM_ERROR, {
          source: 'telegram',
          error: error.message,
        });
      });

      this.bot.on('error', (error: any) => {
        console.error('[Telegram] Error:', error);
        this.eventBus.emit(EventType.SYSTEM_ERROR, {
          source: 'telegram',
          error: error.message,
        });
      });

      // Get bot info
      const botInfo = await this.bot.getMe();
      this.botUsername = botInfo.username || '';
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
