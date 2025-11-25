import fetch from 'node-fetch';

interface TradingConfig {
  apiKey: string;
  baseUrl?: string;
  pool?: 'pump' | 'meteora-dbc';
  defaultSlippage?: number;
  defaultPriorityFee?: number;
}

interface TradeResponse {
  signature?: string;
  error?: string;
}

export class PumpPortalTradingService {
  private apiKey: string;
  private baseUrl: string;
  private pool: 'pump' | 'meteora-dbc';
  private defaultSlippage: number;
  private defaultPriorityFee: number;

  constructor(config: TradingConfig) {
    if (!config.apiKey) {
      throw new Error('PUMPPORTAL_API_KEY is required for trading');
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://pumpportal.fun/api';
    this.pool = config.pool || 'pump';
    this.defaultSlippage = config.defaultSlippage ?? 10;
    this.defaultPriorityFee = config.defaultPriorityFee ?? 0.0005;
  }

  private async postTrade(body: Record<string, unknown>): Promise<string> {
    const response = await fetch(`${this.baseUrl}/trade?api-key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as TradeResponse;
    if (!response.ok || !data.signature) {
      throw new Error(data.error || `Trade failed: ${response.status} ${response.statusText}`);
    }
    return data.signature;
  }

  async buyToken(params: {
    mint: string;
    amountSol: number;
    slippageBps?: number;
    priorityFee?: number;
    pool?: 'pump' | 'meteora-dbc';
  }): Promise<string> {
    return this.postTrade({
      action: 'buy',
      mint: params.mint,
      denominatedInSol: 'true',
      amount: params.amountSol,
      slippage: params.slippageBps ?? this.defaultSlippage,
      priorityFee: params.priorityFee ?? this.defaultPriorityFee,
      pool: params.pool || this.pool,
    });
  }

  async sellToken(params: {
    mint: string;
    tokenAmount: number;
    slippageBps?: number;
    priorityFee?: number;
    pool?: 'pump' | 'meteora-dbc';
  }): Promise<string> {
    return this.postTrade({
      action: 'sell',
      mint: params.mint,
      tokenAmount: params.tokenAmount,
      slippage: params.slippageBps ?? this.defaultSlippage,
      priorityFee: params.priorityFee ?? this.defaultPriorityFee,
      pool: params.pool || this.pool,
    });
  }

  async collectCreatorFee(params?: {
    pool?: 'pump' | 'meteora-dbc';
    mint?: string;
    priorityFee?: number;
  }): Promise<string> {
    return this.postTrade({
      action: 'collectCreatorFee',
      priorityFee: params?.priorityFee ?? this.defaultPriorityFee,
      pool: params?.pool || this.pool,
      mint: params?.mint,
    });
  }
}
