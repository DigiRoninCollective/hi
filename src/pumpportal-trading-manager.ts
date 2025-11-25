import { PumpPortalTradingService } from './pumpportal-trading.service';

export interface TradingWalletConfig {
  id: string; // e.g., "default", "elon_profile"
  apiKey: string;
  pool?: 'pump' | 'meteora-dbc';
  defaultSlippage?: number;
  defaultPriorityFee?: number;
}

export class PumpPortalTradingManager {
  private wallets: Map<string, PumpPortalTradingService>;

  constructor(configs: TradingWalletConfig[]) {
    this.wallets = new Map();
    configs.forEach(cfg => {
      this.wallets.set(
        cfg.id,
        new PumpPortalTradingService({
          apiKey: cfg.apiKey,
          pool: cfg.pool,
          defaultSlippage: cfg.defaultSlippage,
          defaultPriorityFee: cfg.defaultPriorityFee,
        })
      );
    });
  }

  hasWallet(id: string): boolean {
    return this.wallets.has(id);
  }

  getWallet(id: string): PumpPortalTradingService {
    const wallet = this.wallets.get(id);
    if (!wallet) {
      throw new Error(`Trading wallet not found: ${id}`);
    }
    return wallet;
  }

  listWallets(): string[] {
    return Array.from(this.wallets.keys());
  }
}
