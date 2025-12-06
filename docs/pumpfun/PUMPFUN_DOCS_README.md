# PumpFun API Documentation - Quick Reference

## 📚 Documentation Overview

This folder contains comprehensive research and implementation guides for integrating the PumpFun Pump Portal API into your trading system.

**Total Package:** 94 KB | 3,688+ lines | 50+ code examples | 20+ verified sources

---

## 📖 Documents Guide

### 1. **PUMPFUN_API_INDEX.md** ⭐ **START HERE**
- **Purpose:** Navigation guide and integration planning
- **Best for:** Quick overview, integration timeline, troubleshooting
- **Contains:**
  - Document index and cross-references
  - 4 integration patterns with examples
  - 4-week implementation timeline
  - Comprehensive troubleshooting table
  - Performance optimization tips
  - Support resources

**Use this if:** You need a quick overview or want to plan the integration approach

---

### 2. **PUMPFUN_API_RESEARCH.md** 📋 **MAIN REFERENCE**
- **Purpose:** Complete technical documentation
- **Best for:** Developers building the integration
- **Contains:**
  - Official documentation sources (10+)
  - API endpoints and base URLs
  - Authentication methods and rate limiting
  - Core trading operations with examples
  - Data models and schemas
  - Bonding curve mechanics
  - Fee structure and calculations
  - Security best practices
  - 8+ code examples (JavaScript, Python, TypeScript)
  - Key features overview
  - Recommended SDKs and libraries
  - Known limitations and gotchas
  - Monitoring and observability setup
  - Compliance considerations

**Use this if:** You're implementing trading functionality or need detailed technical reference

---

### 3. **PUMPFUN_QUICKSTART.md** 🚀 **READY-TO-USE CODE**
- **Purpose:** Working code templates you can run immediately
- **Best for:** Quick implementation and testing
- **Contains:**
  - 5-minute setup instructions
  - Environment configuration template
  - 5 complete working code examples:
    1. Simple Buy Transaction (18 lines)
    2. Simple Sell Transaction (16 lines)
    3. WebSocket Token Monitor (35 lines)
    4. TypeScript Trader Class (80 lines)
    5. Advanced Bot with Retry Logic (120 lines)
  - Devnet testing procedures
  - Common commands and debugging tips
  - Performance optimization strategies
  - Pre-production checklist
  - Error handling patterns

**Use this if:** You want to quickly test API functionality or start coding

---

### 4. **PUMPFUN_API_SCHEMAS.md** 📊 **TECHNICAL SPECS**
- **Purpose:** Complete schema and interface reference
- **Best for:** Implementation details and data structure validation
- **Contains:**
  - Request/response schemas with examples
  - WebSocket message format specifications (4 event types)
  - Error codes reference (11 error types with solutions)
  - Bonding curve state API schema
  - Token metadata structure
  - Transaction object schema
  - Account/wallet schema
  - Price calculation formulas
  - Computation unit (CU) estimates
  - TypeScript interface collection

**Use this if:** You need exact specifications for requests/responses or error handling

---

## 🔑 Key API Information at a Glance

### Endpoints
| Purpose | Endpoint | Method |
|---------|----------|--------|
| **Buy/Sell** | `https://pumpportal.fun/api/trade-local` | POST |
| **Lightning** | `https://pumpportal.fun/api/trade?api-key=KEY` | POST |
| **Real-time Data** | `wss://pumpportal.fun/api/data` | WebSocket |
| **Bonding Curve** | `https://rpc.api-pump.fun/bondingCurve` | GET |

### Authentication
- **Requires:** API key from https://pumpportal.fun
- **Method:** Query parameter or header
- **Setup:** Accept ToS → Verify compliance → Generate key

### Trading Operations
| Operation | Cost | Notes |
|-----------|------|-------|
| **Buy** | 0.5% + gas | Denominated in SOL |
| **Sell** | 0.5% + gas | Denominated in tokens |
| **Deploy** | 0.002 SOL + gas | Creates new token |

### Critical Security Rules
```
✅ DO:
- Use Local Transaction API (sign locally)
- Store keys in secure vault (AWS KMS, 1Password)
- Implement transaction simulation
- Rate limit API calls appropriately

❌ DON'T:
- Transmit private keys to API
- Hardcode secrets in code
- Use Lightning API with real keys
- Open excessive WebSocket connections
```

---

## 🚀 Quick Start Path

### For Testing (5 minutes)
1. Read: **PUMPFUN_QUICKSTART.md** - Template 1
2. Copy: Simple Buy Transaction code
3. Set: Environment variables
4. Run: On devnet
5. Test: Buy a token

### For Integration (1-2 hours)
1. Read: **PUMPFUN_API_INDEX.md** - Integration section
2. Review: **PUMPFUN_API_RESEARCH.md** - Relevant sections
3. Choose: Integration pattern (1-4)
4. Copy: Code from **PUMPFUN_QUICKSTART.md**
5. Adapt: For your system
6. Test: On devnet

### For Production (Week-long process)
1. Follow: 4-week timeline in **PUMPFUN_API_INDEX.md**
2. Phase 1: Setup and learning
3. Phase 2: Implementation and integration
4. Phase 3: Optimization and testing
5. Phase 4: Production deployment with monitoring

---

## 📝 Integration Patterns

### Pattern 1: Simple Bot
**Best for:** Learning, testing, minimal trading
- **Complexity:** Low
- **Code:** ~100 lines
- **Time:** 1-2 hours
- **Location:** PUMPFUN_QUICKSTART.md - Template 5

### Pattern 2: Advanced Bot
**Best for:** Active trading with retry logic
- **Complexity:** Medium
- **Code:** ~300 lines
- **Time:** 4-8 hours
- **Location:** PUMPFUN_QUICKSTART.md - Custom

### Pattern 3: Monitoring System
**Best for:** Tracking tokens and market activity
- **Complexity:** Medium
- **Code:** ~200 lines
- **Time:** 3-6 hours
- **Location:** PUMPFUN_QUICKSTART.md - Template 3

### Pattern 4: Full Trading System
**Best for:** Production trading bot
- **Complexity:** High
- **Code:** ~1000+ lines
- **Time:** 2-4 weeks
- **Location:** Combine all patterns + PUMPFUN_API_RESEARCH.md

---

## 🔗 Official Resources

### API Documentation
- [PumpPortal Main](https://pumpportal.fun/) - Official service
- [Trading API](https://pumpportal.fun/trading-api/) - Trading endpoints
- [Data API](https://pumpportal.fun/data-api/real-time/) - WebSocket docs
- [Docs Site](https://docs.pmpapi.fun/) - Alternative docs

### Community Implementations
- [thetateman/Pump-Fun-API](https://github.com/thetateman/Pump-Fun-API) - GitHub SDK
- [Synthexlab/pumpfun-sdk](https://github.com/Synthexlab/pumpfun-sdk) - TS/JS SDK
- [cryptoscan-pro/pumpfun-sdk](https://github.com/cryptoscan-pro/pumpfun-sdk) - Toolkit

### Guides & Tutorials
- [Chainstack Guide](https://docs.chainstack.com/docs/solana-creating-a-pumpfun-bot)
- [QuickNode Guide](https://www.quicknode.com/guides/solana-development/tooling/web3-2/pump-fun-api)
- [Bitquery Integration](https://docs.bitquery.io/docs/blockchain/Solana/Pumpfun/pump-fun-to-pump-swap/)

---

## ⚙️ Environment Setup

```bash
# Install dependencies
npm install @solana/web3.js @solana/spl-token bs58

# Create .env file (NEVER commit!)
SOLANA_PRIVATE_KEY=your_base58_private_key_here
PUMP_WALLET_ADDRESS=your_wallet_address_here
PUMP_API_KEY=your_pumpportal_api_key_here
RPC_URL=https://api.mainnet-beta.solana.com

# For devnet testing
RPC_URL=https://api.devnet.solana.com

# For localhost testing
RPC_URL=http://localhost:8899
```

---

## ❓ Common Questions

**Q: Which API should I use - Lightning or Local?**
A: Use Local Transaction API. It's more secure because you control the signing.

**Q: How much does trading cost?**
A: 0.5% fee per trade + Solana network gas (~0.00005 SOL)

**Q: Can I trade on devnet?**
A: Yes! Use devnet RPC for testing without spending real SOL.

**Q: Where do I get an API key?**
A: Visit https://pumpportal.fun, connect wallet, generate in dashboard.

**Q: What's the maximum slippage?**
A: Set to 10-50% depending on volatility. 6002 error = slippage exceeded.

**Q: How do I monitor new tokens?**
A: Use WebSocket subscribeCoinTrades or subscribeNewToken events.

---

## 🐛 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 6002 | Slippage exceeded | Increase slippage parameter |
| 4001 | Invalid API key | Check API key, regenerate if needed |
| 5001 | RPC error | Check RPC endpoint, switch if down |
| ETXFAIL | Transaction failed | Simulate first, check account balance |

See **PUMPFUN_API_INDEX.md** for complete troubleshooting table.

---

## 📊 File Size Reference

| Document | Size | Lines | Purpose |
|----------|------|-------|---------|
| PUMPFUN_API_RESEARCH.md | 35 KB | 1,200+ | Complete technical reference |
| PUMPFUN_QUICKSTART.md | 19 KB | 600+ | Working code examples |
| PUMPFUN_API_SCHEMAS.md | 16 KB | 600+ | Schema specifications |
| PUMPFUN_API_INDEX.md | 13 KB | 500+ | Integration guide |
| **Total** | **94 KB** | **3,688+** | **Comprehensive package** |

---

## 🎯 Next Steps

1. **Read** the appropriate document based on your need
2. **Copy** code examples from PUMPFUN_QUICKSTART.md
3. **Set up** environment variables
4. **Test** on devnet first
5. **Integrate** into your application
6. **Monitor** with WebSocket subscriptions
7. **Deploy** to production when ready

---

## 📞 Support

- **Official Issues:** https://github.com/phantom/phantom-connect-sdk/issues
- **Community Forum:** Solana Discord
- **Documentation:** See links in each file

---

**Last Updated:** November 25, 2025
**Status:** Production Ready ✅
**Version:** 1.0 Complete
