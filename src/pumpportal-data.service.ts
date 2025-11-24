import WebSocket from 'ws';
import { EventBus, EventType } from './events';
import { PumpPortalDataConfig } from './types';

const ENDPOINT = 'wss://pumpportal.fun/api/data';

export class PumpPortalDataService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly config: PumpPortalDataConfig,
    private readonly eventBus: EventBus
  ) {}

  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[PumpPortalData] Disabled via config');
      return;
    }

    this.stopped = false;
    this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private connect() {
    console.log('[PumpPortalData] Connecting to data websocket...');
    this.ws = new WebSocket(ENDPOINT);

    this.ws.on('open', () => {
      console.log('[PumpPortalData] Connected');
      this.subscribe();
      this.eventBus.emit(EventType.ALERT_INFO, {
        title: 'PumpPortal Data connected',
        message: `Connected to ${ENDPOINT}`,
      });
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', (code, reason) => {
      console.warn(`[PumpPortalData] Connection closed (${code}) ${reason.toString()}`);
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[PumpPortalData] Websocket error', err);
      this.eventBus.emit(EventType.ALERT_ERROR, {
        title: 'PumpPortal data error',
        message: String(err),
      });
    });
  }

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.config.subscribeNewTokens) {
      this.send({ method: 'subscribeNewToken' });
    }

    if (this.config.subscribeMigration) {
      this.send({ method: 'subscribeMigration' });
    }

    if (this.config.tokenTradeMints.length > 0) {
      this.send({ method: 'subscribeTokenTrade', keys: this.config.tokenTradeMints });
    }

    if (this.config.accountTradeWallets.length > 0) {
      this.send({ method: 'subscribeAccountTrade', keys: this.config.accountTradeWallets });
    }
  }

  private send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch (err) {
      console.error('[PumpPortalData] Failed to send', err);
    }
  }

  private handleMessage(raw: string) {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn('[PumpPortalData] Non-JSON message', raw.slice(0, 200));
      return;
    }

    const method = parsed?.method || parsed?.type || 'update';
    const summary = this.buildSummary(parsed);

    this.eventBus.emit(EventType.ALERT_INFO, {
      title: `PumpPortal ${method}`,
      message: summary,
      metadata: parsed,
    });
  }

  private buildSummary(payload: any): string {
    if (payload?.data?.mint) {
      return `${payload.data.mint} ${payload.data.amount ?? ''}`.trim();
    }
    if (payload?.data?.owner) {
      return `Account ${payload.data.owner}`;
    }
    return 'PumpPortal update';
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }
}
