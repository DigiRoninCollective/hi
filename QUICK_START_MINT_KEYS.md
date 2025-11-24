# Quick Start: Mint Key Manager & Enhanced CLI

## What Was Added

### 1. Mint Key Persistence
Your token's mint keypairs are now automatically **saved to the database** for recovery. No more lost tokens!

### 2. Custom Contract Support
You can now specify a **custom contract address** when creating tokens.

### 3. Beautiful CLI
New enhanced token creation CLI with **spinners and colors** for better user experience.

---

## Getting Started

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Setup Database Table
Add this table to your Supabase database:

```sql
CREATE TABLE public.mint_keys (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT UNIQUE NOT NULL,
  secret_key_bs58 TEXT NOT NULL,
  token_name TEXT,
  token_symbol TEXT,
  contract_address TEXT,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  creation_signature TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  failed_at TIMESTAMP
);

CREATE INDEX mint_keys_status_idx ON mint_keys(status);
CREATE INDEX mint_keys_created_by_idx ON mint_keys(created_by);
CREATE INDEX mint_keys_created_at_idx ON mint_keys(created_at DESC);
```

### Step 3: Build
```bash
npm run build
```

---

## Using the Enhanced CLI

### Setup Environment
Create/update `.env`:
```env
SOLANA_PRIVATE_KEY=your_base58_key_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Optional
TOKEN_NAME=MyAwesomeToken
TOKEN_SYMBOL=AWESOME
TOKEN_DESCRIPTION=The best token ever
TOKEN_WEBSITE=https://awesome.example.com
TOKEN_TWITTER=https://twitter.com/awesome
TOKEN_TELEGRAM=https://t.me/awesome
CUSTOM_CONTRACT_ADDRESS=EPjFWaJsWCND1234...
TOKEN_IMAGE_PATH=./logo.png
```

### Run Enhanced CLI
```bash
npm run create:enhanced
```

You'll see beautiful progress indicators for each step:
- ✅ Configuration validation
- ✅ Wallet loading
- ✅ Balance checking
- ✅ Mint keypair generation
- ✅ Image loading
- ✅ IPFS upload
- ✅ Token creation
- ✅ Transaction signing
- ✅ Blockchain submission
- ✅ Confirmation

---

## Accessing Stored Mint Keys

### Via MintKeyManager Service
```typescript
import { MintKeyManager } from './src/mint-key-manager';

const manager = new MintKeyManager(supabaseClient);

// Create and save a mint key
const mintKey = await manager.createAndSaveMintKey(
  'MyToken',
  'MYTOKEN',
  'EPjFWaJsWCND...', // custom contract (optional)
  'user123'           // created_by (optional)
);

// Recover a mint key by address
const recovered = await manager.recoverMintKey('EPjFWaJsWCND...');

// Get all mint keys for a user
const userKeys = await manager.getUserMintKeys('user123');

// Get details (without secret key)
const details = await manager.getMintKeyDetails('EPjFWaJsWCND...');

// Mark as confirmed
await manager.markTokenConfirmed(
  'EPjFWaJsWCND...',
  'signature_here',
  'contract_address_here'
);

// Mark as failed
await manager.markTokenFailed('EPjFWaJsWCND...', 'Error message');
```

### Database Queries
```sql
-- Get all pending tokens
SELECT * FROM mint_keys WHERE status = 'pending';

-- Get confirmed tokens with signature
SELECT * FROM mint_keys WHERE status = 'confirmed';

-- Get tokens by user
SELECT * FROM mint_keys WHERE created_by = 'user123';

-- Get failed creations for debugging
SELECT * FROM mint_keys WHERE status = 'failed';
```

---

## Using Custom Contract Addresses

### In API Calls
```typescript
const result = await pumpPortal.createToken({
  ticker: 'MYTOKEN',
  name: 'My Token',
  description: 'Custom contract token',
  contractAddress: 'EPjFWaJsWCND1234567890...',
  tweetId: '123456789',
  tweetAuthor: 'myusername',
  tweetText: 'Check out my token!',
});

console.log(result);
// Output includes:
// {
//   mint: 'EPjFWaJsWCND...',
//   signature: 'tx_signature...'
// }
```

### The contract address will:
- ✅ Be shown in CLI output
- ✅ Be saved to database (mint_keys table)
- ✅ Be recoverable later

---

## Files Changed/Added

### New Files
- `src/mint-key-manager.ts` - Mint key management service
- `src/trade-create-enhanced.ts` - Enhanced CLI with spinners
- `IMPLEMENTATION_SUMMARY.md` - Detailed documentation
- `QUICK_START_MINT_KEYS.md` - This file

### Modified Files
- `src/types.ts` - Added contractAddress to ParsedLaunchCommand
- `src/pumpportal.ts` - Integrated MintKeyManager
- `package.json` - Added chalk, ora dependencies and new script

---

## Troubleshooting

### "Cannot find module 'ora'"
```bash
npm install
npm run build
```

### "Database table not found"
Make sure you ran the SQL migration to create the `mint_keys` table.

### "Mint key not recovering"
Check that the mint address exists in the database:
```sql
SELECT * FROM mint_keys WHERE mint_address = 'EPjFWaJsWCND...';
```

### "Enhanced CLI not showing colors"
Some terminals don't support ANSI colors. Try:
- Using a different terminal emulator
- Setting `FORCE_COLOR=1` in environment
- Running on WSL2 or native Linux/Mac

---

## Security Tips

1. **Never share your SOLANA_PRIVATE_KEY**
   - Keep it in `.env.local` (not git)
   - Add `.env.local` to `.gitignore`

2. **Backup mint keys**
   - Use Supabase backups
   - Export encrypted backups periodically

3. **Monitor failed creations**
   - Check `mint_keys` table for `status = 'failed'`
   - Review error messages for issues

4. **Use Row Level Security**
   ```sql
   ALTER TABLE mint_keys ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users see own keys" ON mint_keys
     FOR SELECT USING (created_by = auth.uid()::text);
   ```

---

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Create database table (SQL above)
3. ✅ Build: `npm run build`
4. ✅ Configure `.env` file
5. ✅ Test: `npm run create:enhanced`
6. ✅ Verify mint keys in database
7. ✅ Set up RLS policies for security

---

## Support

For detailed information, see `IMPLEMENTATION_SUMMARY.md`

For API documentation, check inline comments in:
- `src/mint-key-manager.ts`
- `src/trade-create-enhanced.ts`
- `src/pumpportal.ts`