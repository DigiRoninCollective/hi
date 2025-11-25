import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import { GroqAnalysisResult } from './types';

// Event types for the system
export enum EventType {
  // Ingestion events
  TWEET_RECEIVED = 'tweet:received',
  TWEET_FILTERED = 'tweet:filtered',

  // Classification events
  TWEET_CLASSIFIED = 'tweet:classified',
  LAUNCH_DETECTED = 'launch:detected',
  SPAM_DETECTED = 'spam:detected',

  // Token events
  TOKEN_CREATING = 'token:creating',
  TOKEN_CREATED = 'token:created',
  TOKEN_FAILED = 'token:failed',

  // Transaction events
  TX_SIGNING = 'tx:signing',
  TX_SENT = 'tx:sent',
  TX_CONFIRMED = 'tx:confirmed',
  TX_FAILED = 'tx:failed',

  // Alert events
  ALERT_INFO = 'alert:info',
  ALERT_WARNING = 'alert:warning',
  ALERT_ERROR = 'alert:error',
  ALERT_SUCCESS = 'alert:success',

  // System events
  SYSTEM_STARTED = 'system:started',
  SYSTEM_STOPPED = 'system:stopped',
  SYSTEM_ERROR = 'system:error',

  // Telegram
  TELEGRAM_MESSAGE = 'telegram:message',
}

export interface BaseEvent {
  id: string;
  type: EventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface TweetEvent extends BaseEvent {
  type: EventType.TWEET_RECEIVED | EventType.TWEET_FILTERED | EventType.TWEET_CLASSIFIED;
  data: {
    tweetId: string;
    authorUsername: string;
    text: string;
    classification?: ClassificationResult;
    analysis?: GroqAnalysisResult;
    launchStatus?: string;
    urls?: string[];
    mediaUrls?: string[];
  };
}

export interface LaunchEvent extends BaseEvent {
  type: EventType.LAUNCH_DETECTED;
  data: {
    ticker: string;
    name: string;
    tweetId: string;
    tweetAuthor: string;
    confidence: number;
  };
}

export interface TokenEvent extends BaseEvent {
  type: EventType.TOKEN_CREATING | EventType.TOKEN_CREATED | EventType.TOKEN_FAILED;
  data: {
    ticker: string;
    name: string;
    mint?: string;
    signature?: string;
    error?: string;
  };
}

export interface AlertEvent extends BaseEvent {
  type: EventType.ALERT_INFO | EventType.ALERT_WARNING | EventType.ALERT_ERROR | EventType.ALERT_SUCCESS;
  data: {
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  };
}

export interface ClassificationResult {
  isLaunchCommand: boolean;
  confidence: number;
  category: 'launch' | 'mention' | 'spam' | 'irrelevant';
  ticker?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  riskScore: number;
}

// Type-safe event map
export interface EventMap {
  [EventType.TWEET_RECEIVED]: TweetEvent;
  [EventType.TWEET_FILTERED]: TweetEvent;
  [EventType.TWEET_CLASSIFIED]: TweetEvent;
  [EventType.LAUNCH_DETECTED]: LaunchEvent;
  [EventType.SPAM_DETECTED]: BaseEvent;
  [EventType.TOKEN_CREATING]: TokenEvent;
  [EventType.TOKEN_CREATED]: TokenEvent;
  [EventType.TOKEN_FAILED]: TokenEvent;
  [EventType.TX_SIGNING]: BaseEvent;
  [EventType.TX_SENT]: BaseEvent;
  [EventType.TX_CONFIRMED]: BaseEvent;
  [EventType.TX_FAILED]: BaseEvent;
  [EventType.ALERT_INFO]: AlertEvent;
  [EventType.ALERT_WARNING]: AlertEvent;
  [EventType.ALERT_ERROR]: AlertEvent;
  [EventType.ALERT_SUCCESS]: AlertEvent;
  [EventType.SYSTEM_STARTED]: BaseEvent;
  [EventType.SYSTEM_STOPPED]: BaseEvent;
  [EventType.SYSTEM_ERROR]: BaseEvent;
  [EventType.TELEGRAM_MESSAGE]: BaseEvent;
}

/**
 * Central event bus for component communication
 */
export class EventBus {
  private emitter: EventEmitter;
  private eventHistory: BaseEvent[] = [];
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 1000) {
    this.emitter = new EventEmitter();
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Emit an event to all subscribers
   */
  emit<T extends EventType>(type: T, data: EventMap[T]['data']): BaseEvent {
    const event: BaseEvent = {
      id: uuidv4(),
      type,
      timestamp: new Date(),
      data,
    };

    // Store in history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit to subscribers
    this.emitter.emit(type, event);
    this.emitter.emit('*', event); // Wildcard for SSE

    return event;
  }

  /**
   * Subscribe to a specific event type
   */
  on<T extends EventType>(type: T, handler: (event: EventMap[T]) => void): void {
    this.emitter.on(type, handler);
  }

  /**
   * Subscribe to all events (for SSE streaming)
   */
  onAll(handler: (event: BaseEvent) => void): void {
    this.emitter.on('*', handler);
  }

  /**
   * Unsubscribe from events
   */
  off<T extends EventType>(type: T, handler: (event: EventMap[T]) => void): void {
    this.emitter.off(type, handler);
  }

  /**
   * Remove all event handler
   */
  offAll(handler: (event: BaseEvent) => void): void {
    this.emitter.off('*', handler);
  }

  /**
   * Get recent event history
   */
  getHistory(limit?: number): BaseEvent[] {
    if (limit) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: EventType, limit?: number): BaseEvent[] {
    const filtered = this.eventHistory.filter(e => e.type === type);
    if (limit) {
      return filtered.slice(-limit);
    }
    return filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }
}

// Singleton instance
export const eventBus = new EventBus();
