export interface SeedBuyConfig {
  enabled: boolean;
  solAmount: number;
  slippageBps: number;
  priorityFeeSol: number;
}

export const defaultSeedBuyConfig: SeedBuyConfig = {
  enabled: process.env.SEED_BUY_ENABLED === 'true',
  solAmount: Number(process.env.SEED_BUY_SOL ?? '0.05'),
  slippageBps: Number(process.env.SEED_BUY_SLIPPAGE_BPS ?? '1000'),
  priorityFeeSol: Number(process.env.SEED_BUY_PRIORITY_FEE ?? '0.0005'),
};
