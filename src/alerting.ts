import fetch from 'node-fetch';
import { EventBus, EventType, AlertEvent, TokenEvent, LaunchEvent } from './events';

export interface AlertConfig {
  enabled: boolean;
  webhookUrl?: string;
  discordWebhook?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  consoleOutput: boolean;
}

export interface AlertChannel {
  name: string;
  send: (alert: AlertPayload) => Promise<boolean>;
}

export interface AlertPayload {
  level: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  consoleOutput: true,
};

/**
 * Alerting service for sending notifications through multiple channels
 */
export class AlertingService {
  private config: AlertConfig;
  private eventBus: EventBus;
  private channels: AlertChannel[] = [];

  constructor(eventBus: EventBus, config: Partial<AlertConfig> = {}) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.setupChannels();
    this.setupEventListeners();
  }

  /**
   * Setup alert channels based on config
   */
  private setupChannels(): void {
    // Console channel
    if (this.config.consoleOutput) {
      this.channels.push({
        name: 'console',
        send: async (alert) => {
          const emoji = this.getLevelEmoji(alert.level);
          const timestamp = alert.timestamp.toISOString();
          console.log(`${emoji} [${alert.level.toUpperCase()}] ${alert.title}`);
          console.log(`   ${alert.message}`);
          if (alert.metadata) {
            console.log(`   Metadata:`, JSON.stringify(alert.metadata, null, 2));
          }
          return true;
        },
      });
    }

    // Generic webhook channel
    if (this.config.webhookUrl) {
      this.channels.push({
        name: 'webhook',
        send: async (alert) => {
          try {
            const response = await fetch(this.config.webhookUrl!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(alert),
            });
            return response.ok;
          } catch (error) {
            console.error('Webhook alert failed:', error);
            return false;
          }
        },
      });
    }

    // Discord webhook channel
    if (this.config.discordWebhook) {
      this.channels.push({
        name: 'discord',
        send: async (alert) => {
          try {
            const color = this.getDiscordColor(alert.level);
            const response = await fetch(this.config.discordWebhook!, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                embeds: [{
                  title: alert.title,
                  description: alert.message,
                  color,
                  timestamp: alert.timestamp.toISOString(),
                  fields: alert.metadata
                    ? Object.entries(alert.metadata).map(([name, value]) => ({
                        name,
                        value: String(value),
                        inline: true,
                      }))
                    : [],
                }],
              }),
            });
            return response.ok;
          } catch (error) {
            console.error('Discord alert failed:', error);
            return false;
          }
        },
      });
    }

    // Telegram channel
    if (this.config.telegramBotToken && this.config.telegramChatId) {
      this.channels.push({
        name: 'telegram',
        send: async (alert) => {
          try {
            const emoji = this.getLevelEmoji(alert.level);
            const text = `${emoji} *${alert.title}*\n\n${alert.message}`;
            const url = `https://api.telegram.org/bot${this.config.telegramBotToken}/sendMessage`;

            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: this.config.telegramChatId,
                text,
                parse_mode: 'Markdown',
              }),
            });
            return response.ok;
          } catch (error) {
            console.error('Telegram alert failed:', error);
            return false;
          }
        },
      });
    }
  }

  /**
   * Setup event listeners for automatic alerting
   */
  private setupEventListeners(): void {
    // Alert events
    this.eventBus.on(EventType.ALERT_INFO, (event) => {
      this.sendFromEvent(event as AlertEvent, 'info');
    });

    this.eventBus.on(EventType.ALERT_WARNING, (event) => {
      this.sendFromEvent(event as AlertEvent, 'warning');
    });

    this.eventBus.on(EventType.ALERT_ERROR, (event) => {
      this.sendFromEvent(event as AlertEvent, 'error');
    });

    this.eventBus.on(EventType.ALERT_SUCCESS, (event) => {
      this.sendFromEvent(event as AlertEvent, 'success');
    });

    // Token creation events - auto-alert on success
    this.eventBus.on(EventType.TOKEN_CREATED, (event) => {
      const data = event.data as TokenEvent['data'];
      this.send({
        level: 'success',
        title: 'Token Created Successfully',
        message: `${data.ticker} (${data.name}) has been created on PumpFun`,
        timestamp: new Date(),
        metadata: {
          mint: data.mint,
          signature: data.signature,
          pumpfun: `https://pump.fun/${data.mint}`,
        },
      });
    });

    // Token failure - auto-alert
    this.eventBus.on(EventType.TOKEN_FAILED, (event) => {
      const data = event.data as TokenEvent['data'];
      this.send({
        level: 'error',
        title: 'Token Creation Failed',
        message: `Failed to create ${data.ticker}: ${data.error}`,
        timestamp: new Date(),
        metadata: { ticker: data.ticker, error: data.error },
      });
    });

    // Launch detection - auto-alert
    this.eventBus.on(EventType.LAUNCH_DETECTED, (event) => {
      const data = event.data as LaunchEvent['data'];
      this.send({
        level: 'info',
        title: 'Launch Command Detected',
        message: `@${data.tweetAuthor} triggered launch for ${data.ticker}`,
        timestamp: new Date(),
        metadata: {
          ticker: data.ticker,
          confidence: `${(data.confidence * 100).toFixed(1)}%`,
          tweet: `https://twitter.com/${data.tweetAuthor}/status/${data.tweetId}`,
        },
      });
    });

    // System errors - auto-alert
    this.eventBus.on(EventType.SYSTEM_ERROR, (event) => {
      this.send({
        level: 'error',
        title: 'System Error',
        message: String(event.data.message || 'Unknown error'),
        timestamp: new Date(),
        metadata: event.data,
      });
    });
  }

  /**
   * Send alert from event
   */
  private sendFromEvent(event: AlertEvent, level: AlertPayload['level']): void {
    this.send({
      level,
      title: event.data.title,
      message: event.data.message,
      timestamp: event.timestamp,
      metadata: event.data.metadata,
    });
  }

  /**
   * Send alert through all configured channels
   */
  async send(alert: AlertPayload): Promise<void> {
    if (!this.config.enabled) return;

    const results = await Promise.allSettled(
      this.channels.map(channel => channel.send(alert))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Alert channel ${this.channels[index].name} failed:`, result.reason);
      }
    });
  }

  /**
   * Get emoji for alert level
   */
  private getLevelEmoji(level: AlertPayload['level']): string {
    const emojis = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    };
    return emojis[level];
  }

  /**
   * Get Discord embed color for alert level
   */
  private getDiscordColor(level: AlertPayload['level']): number {
    const colors = {
      info: 0x3498db,    // Blue
      warning: 0xf39c12, // Orange
      error: 0xe74c3c,   // Red
      success: 0x2ecc71, // Green
    };
    return colors[level];
  }

  /**
   * Add a custom alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
    this.channels = [];
    this.setupChannels();
  }
}
