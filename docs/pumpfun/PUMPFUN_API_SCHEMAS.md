# PumpFun API - Complete Schema Reference

## Request/Response Schemas

### Buy Request Schema

```json
{
  "publicKey": "string (Solana address)",
  "action": "buy",
  "mint": "string (token mint address)",
  "amount": "number (in SOL if denominatedInSol=true)",
  "denominatedInSol": true,
  "slippage": "number (0-100, percentage)",
  "priorityFee": "number (SOL amount, e.g., 0.00005)",
  "pool": "string (pump|raydium|pump-amm|launchlab|raydium-cpmm|bonk|auto)"
}
```

**Example:**
```json
{
  "publicKey": "Ey8GEd8BpurzPT1ZDLEJv3jB3eUqHEY5fvqX3X8t4cK2",
  "action": "buy",
  "mint": "CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5",
  "amount": 1.5,
  "denominatedInSol": true,
  "slippage": 10,
  "priorityFee": 0.00005,
  "pool": "pump"
}
```

---

### Sell Request Schema

```json
{
  "publicKey": "string (Solana address)",
  "action": "sell",
  "mint": "string (token mint address)",
  "amount": "number (in tokens if denominatedInSol=false)",
  "denominatedInSol": false,
  "slippage": "number (0-100, percentage)",
  "priorityFee": "number (SOL amount)",
  "pool": "string (pump|raydium|auto)"
}
```

**Example:**
```json
{
  "publicKey": "Ey8GEd8BpurzPT1ZDLEJv3jB3eUqHEY5fvqX3X8t4cK2",
  "action": "sell",
  "mint": "CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5",
  "amount": 1000000,
  "denominatedInSol": false,
  "slippage": 10,
  "priorityFee": 0.00005,
  "pool": "pump"
}
```

---

### Successful Trade Response Schema

```json
{
  "transaction": "base64_encoded_versioned_transaction_bytes",
  "simulationResult": {
    "logs": ["array of transaction logs"],
    "err": null,
    "unitsConsumed": "number (approximate CUs)"
  }
}
```

**Example:**
```json
{
  "transaction": "AgABBgtUdEV4TTAzRmMyRlZkc1Z...base64...truncated",
  "simulationResult": {
    "logs": [
      "Program log: initialize the associated token account",
      "Program TokenkegQfeZyiNwAJsyFbPVwwQkYk1egnSupER7Su invoke [1]",
      "Program log: Account balance: 5000000, required: 2039280"
    ],
    "err": null,
    "unitsConsumed": 23490
  }
}
```

---

### Error Response Schema

```json
{
  "error": "string (human-readable error message)",
  "code": "number (error code)",
  "logs": ["array of transaction logs if applicable"],
  "simulationLogs": ["array of simulation logs if applicable"]
}
```

**Example - Slippage Error:**
```json
{
  "error": "TooMuchSolRequired",
  "code": 6002,
  "logs": [
    "Program log: Instruction: Swap",
    "Program log: slippage: Too much SOL required to buy the given amount of tokens."
  ],
  "simulationLogs": []
}
```

**Example - Insufficient Balance:**
```json
{
  "error": "InsufficientSOL",
  "code": 6004,
  "logs": [
    "Program log: Account balance: 100000 SOL units",
    "Program log: Required: 150000 SOL units"
  ]
}
```

---

## WebSocket Message Schemas

### Subscribe New Token

**Request:**
```json
{
  "method": "subscribeNewToken"
}
```

**Response (Event):**
```json
{
  "type": "newToken",
  "mint": "string (new token mint address)",
  "name": "string (token name)",
  "symbol": "string (token symbol)",
  "description": "string (token description)",
  "image": "string (image URL or base64)",
  "showName": "boolean",
  "createdOn": "string (ISO timestamp)",
  "creator": "string (creator wallet address)",
  "decimals": "number",
  "initialBuy": "number (initial buy amount in lamports)",
  "supply": "string (total supply)",
  "website": "string|null (website URL)",
  "telegram": "string|null (telegram URL)",
  "twitter": "string|null (twitter URL)",
  "bonding_curve": "string (bonding curve account address)",
  "associated_bonding_curve": "string (associated bonding curve ATA)",
  "is_currently_live": "boolean",
  "virtual_token_reserves": "string",
  "virtual_sol_reserves": "string",
  "real_token_reserves": "string",
  "real_sol_reserves": "string",
  "market_cap_sol": "number"
}
```

**Example:**
```json
{
  "type": "newToken",
  "mint": "A5e9ukL8z6z7z7z7z7z7z7z7z7z7z7z7z7z7z7z7z7z",
  "name": "MyNewToken",
  "symbol": "MNT",
  "description": "An awesome new token",
  "image": "https://example.com/image.png",
  "showName": true,
  "createdOn": "2025-11-25T10:30:45Z",
  "creator": "Ey8GEd8BpurzPT1ZDLEJv3jB3eUqHEY5fvqX3X8t4cK2",
  "decimals": 6,
  "initialBuy": 500000,
  "supply": "1000000000000",
  "website": "https://mynewtoken.com",
  "telegram": "https://t.me/mynewtoken",
  "twitter": "https://twitter.com/mynewtoken",
  "bonding_curve": "8aKLuJWfgkkF47WQqz4ydDpf9WW7FdKREsT85GhsFkzV",
  "associated_bonding_curve": "7jGHFSRxZvYqHzGLh7pJ1U2f7BqFLpPn4rVwFvW5YL6N",
  "is_currently_live": true,
  "virtual_token_reserves": "793100000",
  "virtual_sol_reserves": "30000000",
  "real_token_reserves": "206900000",
  "real_sol_reserves": "20000000",
  "market_cap_sol": 2.5
}
```

---

### Subscribe Coin Trades

**Request:**
```json
{
  "method": "subscribeCoinTrades",
  "keys": ["mint_address_1", "mint_address_2"]
}
```

**Response (Event):**
```json
{
  "type": "trade",
  "mint": "string (token mint address)",
  "action": "string (buy|sell)",
  "user": "string (trader wallet address)",
  "amount": "number (amount traded)",
  "amount_in": "number (SOL or token amount in)",
  "amount_out": "number (SOL or token amount out)",
  "price": "number (price per token in SOL)",
  "timestamp": "number (Unix timestamp in seconds)",
  "tx_hash": "string (transaction signature)",
  "virtual_token_reserves": "string",
  "virtual_sol_reserves": "string",
  "real_token_reserves": "string",
  "real_sol_reserves": "string"
}
```

**Example:**
```json
{
  "type": "trade",
  "mint": "CzLSvfkQfcKEVznrVHrqaWTJ4uQzNYmKqLe1pDvLB8b5",
  "action": "buy",
  "user": "abc123def456abc123def456abc123def456abc123de",
  "amount": 500000,
  "amount_in": 2.5,
  "amount_out": 500000,
  "price": 0.000005,
  "timestamp": 1732529445,
  "tx_hash": "5Hqv8k7x9z8x9z8x9z8x9z8x9z8x9z8x9z8x9z8x9z8x9z8",
  "virtual_token_reserves": "1000000000",
  "virtual_sol_reserves": "40000000",
  "real_token_reserves": "600000000",
  "real_sol_reserves": "18000000"
}
```

---

### Subscribe Account Trades

**Request:**
```json
{
  "method": "subscribeAccountTrade",
  "keys": ["wallet_address_1", "wallet_address_2"]
}
```

**Response (Event):**
```json
{
  "type": "accountTrade",
  "user": "string (wallet address)",
  "mint": "string (token mint address)",
  "action": "string (buy|sell)",
  "amount": "number",
  "amount_in": "number",
  "amount_out": "number",
  "price": "number",
  "timestamp": "number (Unix timestamp)",
  "tx_hash": "string (transaction signature)"
}
```

---

### Subscribe Migration Events

**Request:**
```json
{
  "method": "subscribeMigration"
}
```

**Response (Event):**
```json
{
  "type": "migration",
  "mint": "string (token mint address)",
  "name": "string (token name)",
  "symbol": "string (token symbol)",
  "raydium_pool": "string (Raydium LP address)",
  "migration_timestamp": "number (Unix timestamp)",
  "tx_hash": "string (migration transaction signature)"
}
```

---

## Bonding Curve State Schema (api-pump.fun)

### Request

```
GET https://rpc.api-pump.fun/bondingCurve?mint=TOKEN_MINT&api_key=YOUR_API_KEY
```

### Response

```json
{
  "bonding_curve": "string (bonding curve account address)",
  "associated_bonding_curve": "string (ATA address)",
  "virtual_token_reserves": "string (number in lamports)",
  "virtual_sol_reserves": "string (number in lamports)",
  "real_token_reserves": "string (number in lamports)",
  "real_sol_reserves": "string (number in lamports)",
  "total_supply": "string",
  "token_decimals": "number",
  "is_migrated": "boolean",
  "raydium_pool": "string|null (if migrated)",
  "market_cap": "number (in USD)",
  "progress": "number (0-100, % of bonding curve)"
}
```

**Example:**
```json
{
  "bonding_curve": "8aKLuJWfgkkF47WQqz4ydDpf9WW7FdKREsT85GhsFkzV",
  "associated_bonding_curve": "7jGHFSRxZvYqHzGLh7pJ1U2f7BqFLpPn4rVwFvW5YL6N",
  "virtual_token_reserves": "793100000",
  "virtual_sol_reserves": "30000000",
  "real_token_reserves": "206900000",
  "real_sol_reserves": "20000000",
  "total_supply": "1000000000000",
  "token_decimals": 6,
  "is_migrated": false,
  "raydium_pool": null,
  "market_cap": 2500,
  "progress": 42.5
}
```

---

## Token Metadata Schema

### Token Object

```typescript
interface Token {
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  showName: boolean;
  createdOn: string;
  creator: string;
  decimals: number;
  website?: string;
  telegram?: string;
  twitter?: string;
  bonding_curve: string;
  associated_bonding_curve: string;
  is_currently_live: boolean;
  virtual_token_reserves: string;
  virtual_sol_reserves: string;
  real_token_reserves: string;
  real_sol_reserves: string;
  market_cap_sol: number;
  market_cap_usd?: number;
  holder_count?: number;
  transaction_count?: number;
}
```

---

## Transaction Object Schema

```typescript
interface PumpTransaction {
  signature: string;
  slot: number;
  timestamp: number;
  mint: string;
  action: 'buy' | 'sell';
  user: string;
  amount: number;
  amount_in: number;
  amount_out: number;
  price: number;
  virtual_token_reserves: string;
  virtual_sol_reserves: string;
  real_token_reserves: string;
  real_sol_reserves: string;
  status: 'success' | 'failed';
  error?: string;
  logs?: string[];
}
```

---

## Account/Wallet Schema

```typescript
interface WalletAccount {
  address: string;
  balance_lamports: number;
  balance_sol: number;
  tokens: TokenBalance[];
  total_value_usd?: number;
  recent_trades?: PumpTransaction[];
}

interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  ui_amount: number;
  owner: string;
}
```

---

## Error Codes Reference

| Code | Error Name | Meaning | Solution |
|------|------------|---------|----------|
| 6002 | TooMuchSolRequired | Slippage exceeded | Increase slippage % or reduce trade size |
| 6003 | MintTooBig | Mint amount too large | Reduce trade amount |
| 6004 | InsufficientSOL | Not enough SOL balance | Top up wallet |
| 0x16 | InsufficientTokens | Not enough tokens | Reduce sell amount |
| 0x2a | InvalidInstruction | Bad transaction instruction | Check parameters |
| 0xc7 | ConstraintTokenOwner | Token account ownership issue | Use correct token account |
| 0x1771 | InvalidAccountOwner | Wrong account authority | Check wallet ownership |
| null | TransactionSimulationFailed | Simulation failed | Check logs, validate inputs |
| null | TransactionConfirmationTimeout | Took too long to confirm | Retry with higher priority fee |
| null | InvalidAddress | Bad wallet/mint address | Validate Base58 encoding |

---

## Computation Unit (CU) Estimates

**Typical Transaction Costs:**

| Operation | Est. CUs | Est. Cost (SOL) |
|-----------|----------|-----------------|
| Simple Buy | 20,000-30,000 | 0.00001-0.00002 |
| Simple Sell | 20,000-30,000 | 0.00001-0.00002 |
| Complex Trade | 50,000+ | 0.00003+ |
| Token Creation | 100,000+ | 0.00005+ |

**Calculation:**
```
Cost = (ComputeUnits / 1,000,000) × PricePerCU (in SOL)
PricePerCU = Lamports / 1e9  (varies by network)
```

---

## Price Calculation Formula

### Bonding Curve Price

```
Price = (VirtualSOL / VirtualTokens) ^ 2
```

**Example:**
- Virtual SOL: 30,000,000 lamports (0.03 SOL)
- Virtual Tokens: 793,100,000 tokens
- Price = (0.03 / 793.1) ^ 2 = 0.00000001432 SOL per token

### Slippage Calculation

```
SlippageAmount = ExecutedPrice × TradeAmount × (Slippage% / 100)
ActualAmountReceived = TradeAmount - SlippageAmount
```

**Example:**
- Quoted Price: 0.000005 SOL per token
- Trade Amount: 500,000 tokens
- Slippage: 10%
- Slippage Amount: 0.000005 × 500,000 × 0.1 = 2.5 SOL
- Actual Received: 500,000 - 2.5 = ~499,997.5 tokens

---

## Rate Limit Headers

**Typical Response Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1732615800
```

**Interpretation:**
- 1000 requests per period
- 999 requests remaining
- Resets at Unix timestamp 1732615800

---

## Authentication Header Formats

### API Key (Query Parameter)
```
https://pumpportal.fun/api/trade-local?api-key=YOUR_KEY
```

### API Key (Header - if supported)
```
Authorization: Bearer YOUR_API_KEY
```

### Signature (for advanced use)
```
X-Signature: base64_encoded_signature
X-Public-Key: your_public_key
```

---

## Solana Program Addresses

```typescript
// Key addresses for Pump.fun
export const PUMP_PROGRAM_ID = 'PumpFun111111111111111111111111111111111111';
export const PUMP_BONDING_CURVE_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const METAPLEX_METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAqKEsbh5mUvJ5T1f29JwM';

// Common seeds for PDA derivation
export const BONDING_CURVE_SEED = 'bonding-curve';
export const METADATA_SEED = 'metadata';
```

---

## Simulation Response Format

```json
{
  "err": null|{/* error object */},
  "logs": [
    "Program logs...",
    "Instruction logs..."
  ],
  "accounts": [
    {
      "executable": false,
      "lamports": 5000000,
      "owner": "Token...",
      "state": "valid",
      "data": [/* account data */]
    }
  ],
  "unitsConsumed": 23490,
  "returnData": {
    "programId": "...",
    "data": [/* return data */]
  }
}
```

---

## Batch Request Schema (if supported)

```json
{
  "batch": [
    {
      "id": "1",
      "method": "POST",
      "endpoint": "/api/trade-local",
      "payload": { /* trade payload */ }
    },
    {
      "id": "2",
      "method": "POST",
      "endpoint": "/api/trade-local",
      "payload": { /* trade payload */ }
    }
  ]
}
```

---

## Versioned Transaction Schema (Solana)

```json
{
  "version": "legacy|0",
  "signatures": ["base58_encoded_signature"],
  "message": {
    "header": {
      "numRequiredSignatures": 1,
      "numReadonlySignedAccounts": 0,
      "numReadonlyUnsignedAccounts": 8
    },
    "accountKeys": ["base58_account_addresses"],
    "recentBlockhash": "base58_blockhash",
    "instructions": [
      {
        "programIdIndex": 0,
        "accounts": [0, 1, 2],
        "data": "base64_instruction_data"
      }
    ]
  }
}
```

---

## Deserialization Examples

### JavaScript
```typescript
import { VersionedTransaction } from '@solana/web3.js';

const txBuffer = Buffer.from(apiResponse.transaction, 'base64');
const tx = VersionedTransaction.deserialize(txBuffer);
console.log(tx.message.recentBlockhash);
console.log(tx.message.accountKeys.length);
```

### Python
```python
from solders.transaction import VersionedTransaction

tx_data = base64.b64decode(api_response['transaction'])
tx = VersionedTransaction.from_bytes(tx_data)
print(tx.message.recent_blockhash)
```

### Rust
```rust
use solana_sdk::serde_json::from_slice;
use solana_transaction_status::UiTransaction;

let tx_bytes = base64::decode(&api_response.transaction)?;
let tx = VersionedTransaction::try_deserialize(&tx_bytes)?;
```

---

## Complete TypeScript Interface Collection

```typescript
// All request/response interfaces
export interface BuyRequest {
  publicKey: string;
  action: 'buy';
  mint: string;
  amount: number;
  denominatedInSol: true;
  slippage: number;
  priorityFee: number;
  pool: 'pump' | 'raydium' | 'pump-amm' | 'launchlab' | 'raydium-cpmm' | 'bonk' | 'auto';
}

export interface SellRequest {
  publicKey: string;
  action: 'sell';
  mint: string;
  amount: number;
  denominatedInSol: false;
  slippage: number;
  priorityFee: number;
  pool: string;
}

export interface TradeResponse {
  transaction: string; // base64 encoded
  simulationResult: {
    logs: string[];
    err: null | object;
    unitsConsumed?: number;
  };
}

export interface TradeError {
  error: string;
  code?: number;
  logs?: string[];
  simulationLogs?: string[];
}

export interface NewTokenEvent {
  type: 'newToken';
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  creator: string;
  decimals: number;
  bonding_curve: string;
  is_currently_live: boolean;
  virtual_token_reserves: string;
  virtual_sol_reserves: string;
  real_token_reserves: string;
  real_sol_reserves: string;
  market_cap_sol: number;
  [key: string]: any;
}

export interface TradeEvent {
  type: 'trade';
  mint: string;
  action: 'buy' | 'sell';
  user: string;
  amount: number;
  amount_in: number;
  amount_out: number;
  price: number;
  timestamp: number;
  tx_hash: string;
}

export interface MigrationEvent {
  type: 'migration';
  mint: string;
  raydium_pool: string;
  migration_timestamp: number;
  tx_hash: string;
}

export type WebSocketEvent = NewTokenEvent | TradeEvent | MigrationEvent;
```

---

**Last Updated:** 2025-11-25
**Version:** 1.0
**Status:** Complete Reference
