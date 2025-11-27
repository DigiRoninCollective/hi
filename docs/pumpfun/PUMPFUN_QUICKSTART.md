# PumpFun API Quick Start Guide

## 5-Minute Setup

### 1. Install Dependencies

```bash
npm install @solana/web3.js @solana/spl-token bs58 node-fetch
# OR use yarn/pnpm
yarn add @solana/web3.js @solana/spl-token bs58 node-fetch
```

### 2. Create Environment Configuration

```bash
# .env (NEVER commit this file!)
SOLANA_PRIVATE_KEY=your_base58_private_key_here
PUMP_WALLET_ADDRESS=your_wallet_address_here
RPC_URL=https://api.mainnet-beta.solana.com
```

### 3. Get API Key

1. Visit https://pumpportal.fun
2. Connect wallet
3. Generate API key (found in dashboard)
4. Save it securely (use environment variable)

---

## Working Code Templates

### Template 1: Simple Buy Transaction

**File:** `buy-token.js`

```javascript
const fetch = require('node-fetch');
const { Connection, VersionedTransaction, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

async function buyToken() {
  try {
    // Configuration
    const WALLET_ADDRESS = process.env.PUMP_WALLET_ADDRESS;
    const TOKEN_MINT = 'CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5'; // Example token
    const SOL_AMOUNT = 0.5; // 0.5 SOL
    const SLIPPAGE = 10; // 10% max slippage

    // Request transaction from API
    console.log('Building transaction...');
    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: WALLET_ADDRESS,
        action: 'buy',
        mint: TOKEN_MINT,
        amount: SOL_AMOUNT,
        denominatedInSol: true,
        slippage: SLIPPAGE,
        priorityFee: 0.00005,
        pool: 'pump'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      return;
    }

    // Parse transaction
    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));

    // Sign with keypair
    console.log('Signing transaction...');
    const privateKeyBytes = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    tx.sign([keypair]);

    // Send transaction
    console.log('Sending transaction...');
    const connection = new Connection(process.env.RPC_URL);
    const signature = await connection.sendRawTransaction(tx.serialize());

    console.log('Transaction sent:', signature);
    console.log('Waiting for confirmation...');

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transaction confirmed!');
    console.log('https://solscan.io/tx/' + signature);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

buyToken();
```

**Run:**
```bash
node buy-token.js
```

---

### Template 2: Simple Sell Transaction

**File:** `sell-token.js`

```javascript
const fetch = require('node-fetch');
const { Connection, VersionedTransaction, Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

async function sellToken() {
  try {
    const WALLET_ADDRESS = process.env.PUMP_WALLET_ADDRESS;
    const TOKEN_MINT = 'CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5';
    const TOKEN_AMOUNT = 1000000; // 1M tokens (adjust for decimals)
    const SLIPPAGE = 10;

    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: WALLET_ADDRESS,
        action: 'sell',
        mint: TOKEN_MINT,
        amount: TOKEN_AMOUNT,
        denominatedInSol: false,
        slippage: SLIPPAGE,
        priorityFee: 0.00005,
        pool: 'pump'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('API Error:', error);
      return;
    }

    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));

    const privateKeyBytes = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    tx.sign([keypair]);

    const connection = new Connection(process.env.RPC_URL);
    const signature = await connection.sendRawTransaction(tx.serialize());

    console.log('Sell transaction:', signature);
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    console.log('Sell confirmed!');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

sellToken();
```

---

### Template 3: WebSocket Token Monitor

**File:** `monitor-tokens.js`

```javascript
const WebSocket = require('ws');

function subscribeToNewTokens() {
  const ws = new WebSocket('wss://pumpportal.fun/api/data');

  ws.on('open', () => {
    console.log('Connected to PumpPortal');
    ws.send(JSON.stringify({
      method: 'subscribeNewToken'
    }));
  });

  ws.on('message', (data) => {
    try {
      const event = JSON.parse(data);

      console.log('\n--- NEW TOKEN ---');
      console.log('Mint:', event.mint);
      console.log('Name:', event.name);
      console.log('Symbol:', event.symbol);
      console.log('Creator:', event.creator);
      console.log('Supply:', event.supply);
      console.log('Time:', new Date(event.timestamp * 1000).toISOString());

      // Example: Auto-buy tokens with specific criteria
      if (shouldBuyToken(event)) {
        console.log('>>> MATCH FOUND - Consider buying!');
      }

    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('Connection closed. Reconnecting...');
    setTimeout(subscribeToNewTokens, 3000);
  });

  return ws;
}

function shouldBuyToken(token) {
  // Example criteria
  return (
    token.name.length < 50 &&  // Not too long name
    token.symbol.length <= 10 && // Valid symbol
    token.creator !== 'SOLANDY5pPLVmmKABQJDfvGwCk6hRg3HwBhFBPp7ZL' // Not known scammer
  );
}

subscribeToNewTokens();
```

**Run:**
```bash
node monitor-tokens.js
```

---

### Template 4: TypeScript Version (Recommended)

**File:** `pump-trading.ts`

```typescript
import fetch from 'node-fetch';
import { Connection, VersionedTransaction, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';

dotenv.config();

interface TradeParams {
  mint: string;
  amount: number;
  action: 'buy' | 'sell';
  slippage?: number;
  priorityFee?: number;
}

class PumpFunTrader {
  private connection: Connection;
  private keypair: Keypair;
  private walletAddress: string;

  constructor() {
    const privateKey = process.env.SOLANA_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('SOLANA_PRIVATE_KEY not set in environment');
    }

    const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.connection = new Connection(rpcUrl);

    const privateKeyBytes = bs58.decode(privateKey);
    this.keypair = Keypair.fromSecretKey(privateKeyBytes);
    this.walletAddress = this.keypair.publicKey.toBase58();
  }

  async buy(params: TradeParams): Promise<string | null> {
    return this.trade({
      ...params,
      action: 'buy',
      slippage: params.slippage || 10
    });
  }

  async sell(params: TradeParams): Promise<string | null> {
    return this.trade({
      ...params,
      action: 'sell',
      slippage: params.slippage || 10
    });
  }

  private async trade(params: TradeParams): Promise<string | null> {
    try {
      // Validate inputs
      if (!this.isValidAddress(params.mint)) {
        throw new Error('Invalid mint address');
      }

      // Build payload
      const payload = {
        publicKey: this.walletAddress,
        action: params.action,
        mint: params.mint,
        amount: params.amount,
        denominatedInSol: params.action === 'buy',
        slippage: params.slippage || 10,
        priorityFee: params.priorityFee || 0.00005,
        pool: 'pump'
      };

      console.log(`Executing ${params.action} trade:`, payload);

      // Request transaction
      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`API Error: ${JSON.stringify(error)}`);
      }

      // Deserialize transaction
      const data = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(data));

      // Sign
      tx.sign([this.keypair]);

      // Send
      const signature = await this.connection.sendRawTransaction(tx.serialize());
      console.log(`Transaction sent: ${signature}`);

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      console.log(`Transaction confirmed: ${signature}`);
      return signature;

    } catch (error) {
      console.error(`Trade failed: ${error instanceof Error ? error.message : error}`);
      return null;
    }
  }

  private isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

// Usage
async function main() {
  const trader = new PumpFunTrader();

  // Buy
  const buyTx = await trader.buy({
    mint: 'CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5',
    amount: 0.5,
    slippage: 10
  });

  if (buyTx) {
    console.log('Buy successful:', buyTx);
  }
}

main().catch(console.error);
```

**Compile and run:**
```bash
npx ts-node pump-trading.ts
```

---

### Template 5: Advanced with Error Handling

**File:** `advanced-pump-bot.ts`

```typescript
import fetch from 'node-fetch';
import { Connection, VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as fs from 'fs';

interface Trade {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  mint: string;
  amount: number;
  signature?: string;
  status: 'pending' | 'confirmed' | 'failed';
  error?: string;
}

class AdvancedPumpBot {
  private trades: Trade[] = [];
  private connection: Connection;
  private keypair: Keypair;
  private maxRetries = 3;
  private retryDelay = 2000; // ms

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcUrl);
    this.keypair = Keypair.fromSecretKey(
      bs58.decode(process.env.SOLANA_PRIVATE_KEY!)
    );
  }

  async buy(mint: string, solAmount: number, slippage: number = 10) {
    return this.executeTradeWithRetry('buy', mint, solAmount, slippage);
  }

  async sell(mint: string, tokenAmount: number, slippage: number = 10) {
    return this.executeTradeWithRetry('sell', mint, tokenAmount, slippage);
  }

  private async executeTradeWithRetry(
    action: 'buy' | 'sell',
    mint: string,
    amount: number,
    slippage: number,
    attempt: number = 1
  ): Promise<string | null> {
    const tradeId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const trade: Trade = {
      id: tradeId,
      timestamp: Date.now(),
      type: action,
      mint,
      amount,
      status: 'pending'
    };

    try {
      const signature = await this.executeTrade(action, mint, amount, slippage);

      if (signature) {
        trade.signature = signature;
        trade.status = 'confirmed';
        this.logTrade(trade);
        return signature;
      } else {
        throw new Error('No signature returned');
      }

    } catch (error) {
      trade.error = error instanceof Error ? error.message : String(error);

      if (attempt < this.maxRetries) {
        console.log(`Retry ${attempt}/${this.maxRetries} after ${this.retryDelay}ms...`);
        await this.delay(this.retryDelay);
        return this.executeTradeWithRetry(action, mint, amount, slippage, attempt + 1);
      }

      trade.status = 'failed';
      this.logTrade(trade);
      return null;
    }
  }

  private async executeTrade(
    action: 'buy' | 'sell',
    mint: string,
    amount: number,
    slippage: number
  ): Promise<string | null> {
    const payload = {
      publicKey: this.keypair.publicKey.toBase58(),
      action,
      mint,
      amount,
      denominatedInSol: action === 'buy',
      slippage,
      priorityFee: 0.00005,
      pool: 'pump'
    };

    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      this.handleApiError(errorData);
      return null;
    }

    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([this.keypair]);

    const signature = await this.connection.sendRawTransaction(tx.serialize());

    // Wait for confirmation with timeout
    const confirmed = await this.confirmTransactionWithTimeout(signature, 60000);

    if (!confirmed) {
      throw new Error('Transaction confirmation timeout');
    }

    return signature;
  }

  private async confirmTransactionWithTimeout(
    signature: string,
    timeoutMs: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), timeoutMs);

      this.connection
        .confirmTransaction(signature, 'confirmed')
        .then(() => {
          clearTimeout(timeout);
          resolve(true);
        })
        .catch(() => {
          clearTimeout(timeout);
          resolve(false);
        });
    });
  }

  private handleApiError(error: any): void {
    const code = error.code;
    let message = error.error || 'Unknown error';

    if (code === 6002) {
      message = 'Slippage exceeded - increase slippage percentage';
    } else if (code === 6004) {
      message = 'Insufficient SOL balance';
    } else if (code === 6003) {
      message = 'Mint amount exceeds limits';
    }

    console.error(`API Error [${code}]: ${message}`);
  }

  private logTrade(trade: Trade): void {
    this.trades.push(trade);

    const logEntry = JSON.stringify(trade) + '\n';
    fs.appendFileSync('trades.log', logEntry);

    console.log(`Trade ${trade.id}:`, {
      type: trade.type,
      mint: trade.mint,
      amount: trade.amount,
      status: trade.status,
      signature: trade.signature,
      error: trade.error
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getTradeHistory(): Trade[] {
    return this.trades;
  }

  getStats() {
    const total = this.trades.length;
    const successful = this.trades.filter(t => t.status === 'confirmed').length;
    const failed = this.trades.filter(t => t.status === 'failed').length;

    return {
      totalTrades: total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) + '%' : '0%'
    };
  }
}

// Usage
async function main() {
  const bot = new AdvancedPumpBot();

  // Buy token
  console.log('Buying token...');
  const buyTx = await bot.buy('CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5', 0.1, 10);

  if (buyTx) {
    console.log('Buy successful!');

    // Wait before selling
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Sell token
    console.log('Selling token...');
    const sellTx = await bot.sell('CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5', 1000000, 10);

    if (sellTx) {
      console.log('Sell successful!');
    }
  }

  // Print stats
  console.log('\nTrading Stats:', bot.getStats());
}

main().catch(console.error);
```

---

## Configuration Template

**File:** `config.ts`

```typescript
export const PUMP_CONFIG = {
  // API Endpoints
  api: {
    tradeLocal: 'https://pumpportal.fun/api/trade-local',
    lightningTrade: 'https://pumpportal.fun/api/trade',
    wsData: 'wss://pumpportal.fun/api/data'
  },

  // Trading Defaults
  trading: {
    defaultSlippage: 10, // percentage
    defaultPriorityFee: 0.00005, // SOL
    pool: 'pump' as const
  },

  // Risk Management
  limits: {
    maxTradeSize: 10, // SOL
    maxSlippage: 50, // percentage
    minTradeSize: 0.01 // SOL
  },

  // Retry Policy
  retry: {
    maxAttempts: 3,
    delayMs: 2000,
    backoffMultiplier: 1.5
  },

  // Timeouts
  timeouts: {
    apiRequest: 30000, // ms
    txConfirmation: 60000 // ms
  },

  // Monitoring
  monitoring: {
    logTrades: true,
    logPath: './trades.log',
    emitMetrics: true
  }
};
```

---

## Environment Setup

**File:** `.env.example`

```bash
# Required
SOLANA_PRIVATE_KEY=your_base58_encoded_private_key

# Optional
PUMP_WALLET_ADDRESS=your_wallet_address
RPC_URL=https://api.mainnet-beta.solana.com
PUMP_API_KEY=your_api_key_for_lightning_api

# Config
DEBUG=false
LOG_LEVEL=info
```

**Setup:**
```bash
cp .env.example .env
# Edit .env and add your keys
```

---

## Testing on Devnet

```javascript
// Use devnet for testing
const connection = new Connection('https://api.devnet.solana.com');

// Request devnet SOL from faucet
const faucetUrl = 'https://faucet.solana.com';

// Test with small amounts
const testBuyAmount = 0.01; // 0.01 SOL only
```

---

## Common Commands

```bash
# Check wallet balance
npx ts-node check-balance.ts

# Test connection
npx ts-node test-connection.ts

# Monitor new tokens
node monitor-tokens.js

# Execute buy
npx ts-node buy-token.ts --mint=ADDRESS --amount=0.5

# Execute sell
npx ts-node sell-token.ts --mint=ADDRESS --amount=1000000

# View trade history
npx ts-node view-trades.ts
```

---

## Debugging Tips

### Enable Verbose Logging

```typescript
// Add to your bot
process.env.DEBUG = 'true';

console.log('Wallet:', keypair.publicKey.toBase58());
console.log('RPC:', connection.rpcEndpoint);
console.log('Payload:', JSON.stringify(payload, null, 2));
```

### Check Transaction on Solscan

```
https://solscan.io/tx/SIGNATURE_HERE
```

### Monitor Token on Pump.fun

```
https://pump.fun/coin/MINT_ADDRESS
```

### Check Real-time Events

```
wss://pumpportal.fun/api/data
```

---

## Performance Tips

1. **Reuse WebSocket Connection**
   - One connection per bot instance
   - Subscribe multiple tokens to same connection

2. **Batch Operations**
   - Group trades by priority
   - Use priority fees strategically

3. **Monitor Gas**
   - Track failed transactions (waste SOL)
   - Adjust slippage to reduce failures

4. **Rate Limiting**
   - Respect API rate limits
   - Implement backoff strategy

5. **Connection Pooling**
   - Use persistent RPC connections
   - Failover to backup RPC

---

## Checklist Before Production

- [ ] Private key stored securely
- [ ] API key restricted to IP/wallet
- [ ] Error handling implemented
- [ ] Retry logic in place
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Risk limits defined
- [ ] Tested on devnet
- [ ] Gas estimation validated
- [ ] Security audit completed

---

## Support & Resources

- **PumpPortal Telegram:** https://t.me/PumpPortalAPI
- **GitHub Issues:** Check community repos for solutions
- **Solscan:** https://solscan.io (verify transactions)
- **Devnet Faucet:** https://faucet.solana.com

---

**Last Updated:** 2025-11-25
**Version:** 1.0
