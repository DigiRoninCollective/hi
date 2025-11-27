
**NEVER:**
- ❌ Transmit private keys to API
- ❌ Hardcode secrets in code
- ❌ Use Lightning API with real keys
- ❌ Open excessive WebSocket connections

---

## 📖 File Descriptions

### PUMPFUN_DOCS_README.md
- **Size:** 9.1 KB | 299 lines
- **Type:** Navigation guide
- **Purpose:** Quick reference and document index
- **Read time:** 5 minutes
- **Best for:** First-time readers, choosing which file to read

### PUMPFUN_API_RESEARCH.md
- **Size:** 35 KB | 1,276 lines
- **Type:** Comprehensive technical reference
- **Purpose:** Complete API documentation
- **Read time:** 30-60 minutes
- **Best for:** Deep learning, implementation details

### PUMPFUN_QUICKSTART.md
- **Size:** 19 KB | 828 lines
- **Type:** Working code examples
- **Purpose:** Ready-to-use templates
- **Read time:** 15 minutes
- **Best for:** Rapid implementation, testing

### PUMPFUN_API_SCHEMAS.md
- **Size:** 16 KB | 756 lines
- **Type:** Technical specifications
- **Purpose:** Schema references
- **Read time:** 10-20 minutes
- **Best for:** Implementation details, validation

### PUMPFUN_API_INDEX.md
- **Size:** 13 KB | 481 lines
- **Type:** Integration planning
- **Purpose:** Timeline and patterns
- **Read time:** 10 minutes
- **Best for:** Project planning, integration patterns

### PUMPFUN_RESEARCH_SUMMARY.txt
- **Size:** 12 KB | 382 lines
- **Type:** Executive summary
- **Purpose:** Quick overview for stakeholders
- **Read time:** 5-10 minutes
- **Best for:** Management review, quick lookup

---

## 🎯 Next Steps

1. **Read** the appropriate document
2. **Copy** code examples from QUICKSTART
3. **Setup** environment variables
4. **Test** on devnet
5. **Integrate** into your application
6. **Deploy** to production

---

**Last Updated:** November 25, 2025
**Status:** ✅ Production Ready
**Total Size:** 100 KB | 4,022+ lines
# Documentation

All Markdown docs now live in `docs/`. The main project overview that used to be in the repository root is now `docs/PROJECT_README.md` (run commands there from the repo root).

## Project docs
- `PROJECT_README.md` - Primary project overview, setup, and API details (moved from root)
- `QUICK_START.md` - High-level commands to install, build, and run
- `QUICK_START_MINT_KEYS.md` - Mint-keys quick start flow
- `IMPLEMENTATION_SUMMARY.md` / `IMPLEMENTATION_COMPLETE.md` - Implementation status and milestones
- `PROJECT_STATUS.md` / `CHANGES_SUMMARY.md` - Current status and change log
- `APIS_AND_SERVICES.md` - Service/API inventory
- `TESTING_GUIDE.md` - Test plan and coverage notes
- `SECURITY.md` - Security practices and risk notes
- `KEYPAIR_ARCHITECTURE.md` / `KEYPAIR_IMPLEMENTATION_INDEX.md` / `KEYPAIR_MANAGEMENT_GUIDE.md` - Key management architecture and guides
- `DATABASE_SETUP_COMPLETE.md` / `CROSS_PLATFORM_DEPLOYMENT.md` / `ELECTRON_FEATURES_PLAN.md` - Deployment and platform plans
- `TWITTER_FEED_ENHANCEMENTS.md` / `TWEET_METADATA_GUIDE.md` / `GITHUB_ACTIONS_BUILDS.md` - Feature and CI/CD references

## PumpFun docs
- `pumpfun/PUMPFUN_DOCS_README.md` - **START HERE** navigation guide
- `pumpfun/PUMPFUN_API_RESEARCH.md` - Full technical reference (35 KB, 1,276 lines)
- `pumpfun/PUMPFUN_QUICKSTART.md` - Working code examples and templates
- `pumpfun/PUMPFUN_API_SCHEMAS.md` - Technical specifications and schemas
- `pumpfun/PUMPFUN_API_INDEX.md` - Integration planning and timeline
- `pumpfun/PUMPFUN_RESEARCH_SUMMARY.txt` - Executive summary

**PumpFun quick start:**
```bash
# Read the navigation guide
cat pumpfun/PUMPFUN_DOCS_README.md

# Jump to the file you need:
# - pumpfun/PUMPFUN_API_RESEARCH.md  (full reference)
# - pumpfun/PUMPFUN_QUICKSTART.md    (code examples)
# - pumpfun/PUMPFUN_API_SCHEMAS.md   (specs)
```

## Structure

```
docs/
├── PROJECT_README.md
├── QUICK_START.md
├── QUICK_START_MINT_KEYS.md
├── IMPLEMENTATION_SUMMARY.md
├── IMPLEMENTATION_COMPLETE.md
├── PROJECT_STATUS.md
├── CHANGES_SUMMARY.md
├── APIS_AND_SERVICES.md
├── TESTING_GUIDE.md
├── SECURITY.md
├── KEYPAIR_ARCHITECTURE.md
├── KEYPAIR_IMPLEMENTATION_INDEX.md
├── KEYPAIR_MANAGEMENT_GUIDE.md
├── DATABASE_SETUP_COMPLETE.md
├── CROSS_PLATFORM_DEPLOYMENT.md
├── ELECTRON_FEATURES_PLAN.md
├── TWITTER_FEED_ENHANCEMENTS.md
├── TWEET_METADATA_GUIDE.md
├── GITHUB_ACTIONS_BUILDS.md
└── pumpfun/
    ├── PUMPFUN_DOCS_README.md
    ├── PUMPFUN_API_RESEARCH.md
    ├── PUMPFUN_QUICKSTART.md
    ├── PUMPFUN_API_SCHEMAS.md
    ├── PUMPFUN_API_INDEX.md
    └── PUMPFUN_RESEARCH_SUMMARY.txt
```
