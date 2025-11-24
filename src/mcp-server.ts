/**
 * Model Context Protocol (MCP) server for PumpFun Twitter Launcher.
 *
 * Exposes health/config info plus a few token actions (balance, launch, buy)
 * so MCP clients (Claude Desktop, etc.) can drive the app via STDIO.
 *
 * Start with: npm run mcp
 */
import fs from 'fs';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequest,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequest,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { FullConfig, loadConfig } from './config';
import { PumpPortalService } from './pumpportal';
import { ParsedLaunchCommand } from './types';
import { eventBus, EventType } from './events';

type HealthIssue = { level: 'error' | 'warning'; message: string };

const server = new Server(
  {
    name: 'pumpfun-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

function mask(value?: string): string {
  if (!value) return '(not set)';
  if (value.length <= 8) return '••••';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function checkEnvironment(): { ready: boolean; issues: HealthIssue[] } {
  const issues: HealthIssue[] = [];
  const envPath = path.join(process.cwd(), '.env');
  const hasEnv = fs.existsSync(envPath);

  if (!hasEnv) {
    issues.push({ level: 'error', message: '.env file not found (copy .env.example to .env)' });
  } else {
    const envContent = fs.readFileSync(envPath, 'utf-8');

    if (!envContent.includes('SOLANA_PRIVATE_KEY=')) {
      issues.push({ level: 'error', message: 'Missing SOLANA_PRIVATE_KEY' });
    }
    if (!envContent.includes('PUMPPORTAL_API_KEY=')) {
      issues.push({ level: 'error', message: 'Missing PUMPPORTAL_API_KEY' });
    }
    if (envContent.includes('SOLANA_RPC_URL=https://api.mainnet-beta.solana.com')) {
      issues.push({ level: 'warning', message: 'Using public mainnet RPC; consider Helius/QuickNode/Shyft' });
    }
    if (envContent.includes('SOLANA_RPC_URL=https://api.devnet.solana.com')) {
      issues.push({ level: 'warning', message: 'Using devnet RPC (testing mode)' });
    }
  }

  if (!fs.existsSync(path.join(process.cwd(), 'node_modules'))) {
    issues.push({ level: 'error', message: 'Dependencies not installed (run npm install)' });
  }

  if (!fs.existsSync(path.join(process.cwd(), 'dist'))) {
    issues.push({ level: 'warning', message: 'dist/ not found (run npm run build)' });
  }

  const ready = issues.filter(i => i.level === 'error').length === 0;
  return { ready, issues };
}

function summarizeConfig(config: FullConfig) {
  return {
    solana: {
      rpcUrl: config.solana.rpcUrl,
      privateKey: mask(config.solana.privateKey),
    },
    pumpPortal: {
      apiKey: mask(config.pumpPortal.apiKey),
    },
    tokenDefaults: config.tokenDefaults,
    twitter: {
      enabled: config.twitter.enabled,
      usernames: config.twitter.usernames,
      hashtags: config.twitter.hashtags,
      bearerToken: mask(config.twitter.bearerToken),
    },
    sse: config.sse,
    alerting: config.alerting,
    groq: {
      ...config.groq,
      apiKey: mask(config.groq.apiKey),
      secondaryModel: config.groq.secondaryModel,
    },
    alpha: {
      ...config.alpha,
      discord: { ...config.alpha.discord, botToken: mask(config.alpha.discord.botToken) },
      telegram: { ...config.alpha.telegram, botToken: mask(config.alpha.telegram.botToken) },
      reddit: { ...config.alpha.reddit, clientSecret: mask(config.alpha.reddit.clientSecret) },
    },
  };
}

function buildManualLaunchCommand(args: Record<string, unknown>): ParsedLaunchCommand {
  const ticker = String(args.ticker || '').trim().toUpperCase();
  const name = String(args.name || '').trim();

  if (!ticker) {
    throw new Error('ticker is required');
  }
  if (!name) {
    throw new Error('name is required');
  }

  return {
    ticker,
    name,
    description: args.description ? String(args.description) : undefined,
    website: args.website ? String(args.website) : undefined,
    imageUrl: args.imageUrl ? String(args.imageUrl) : undefined,
    bannerUrl: args.bannerUrl ? String(args.bannerUrl) : undefined,
    avatarUrl: args.avatarUrl ? String(args.avatarUrl) : undefined,
    twitterHandle: args.twitterHandle ? String(args.twitterHandle) : undefined,
    tweetAuthor: 'mcp',
    tweetId: `mcp-${Date.now()}`,
    tweetText: args.tweetText ? String(args.tweetText) : `MCP launch request for ${ticker}`,
  };
}

function getResourceList() {
  const resources = [];
  const files = [
    { file: 'README.md', description: 'Project overview and usage' },
    { file: '.env.example', description: 'Environment variable template' },
  ];

  for (const entry of files) {
    const filePath = path.join(process.cwd(), entry.file);
    if (fs.existsSync(filePath)) {
      resources.push({
        uri: `file:${entry.file}`,
        name: entry.file,
        description: entry.description,
        mimeType: entry.file.endsWith('.md') ? 'text/markdown' : 'text/plain',
      });
    }
  }

  return resources;
}

function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'health_check',
      description: 'Check environment readiness (.env, deps, build output)',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'config_summary',
      description: 'Return sanitized config values (no secrets)',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'wallet_balance',
      description: 'Get the bot wallet SOL balance from PumpPortal connection',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: 'launch_token',
      description: 'Create a new token via PumpPortal using manual inputs (bypasses Twitter)',
      inputSchema: {
        type: 'object',
        properties: {
          ticker: { type: 'string', description: 'Token ticker, 2-10 uppercase chars' },
          name: { type: 'string', description: 'Token name' },
          description: { type: 'string' },
          website: { type: 'string' },
          imageUrl: { type: 'string' },
          bannerUrl: { type: 'string' },
          avatarUrl: { type: 'string' },
          twitterHandle: { type: 'string' },
          tweetText: { type: 'string' },
        },
        required: ['ticker', 'name'],
        additionalProperties: false,
      },
    },
    {
      name: 'buy_token',
      description: 'Execute a buy on an existing token via PumpPortal',
      inputSchema: {
        type: 'object',
        properties: {
          mint: { type: 'string', description: 'Mint address of the token' },
          amountSol: { type: 'number', description: 'Amount of SOL to spend' },
        },
        required: ['mint', 'amountSol'],
        additionalProperties: false,
      },
    },
    {
      name: 'event_history',
      description: 'Return recent events from the in-memory event bus',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max events to return', default: 20 },
        },
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<any> => {
  const args = (request.params.arguments || {}) as Record<string, unknown>;

  switch (request.params.name) {
    case 'health_check': {
      const status = checkEnvironment();
      return {
        content: [
          { type: 'text', text: formatJson(status) },
        ],
      };
    }
    case 'config_summary': {
      const config = loadConfig();
      return {
        content: [
          { type: 'text', text: formatJson(summarizeConfig(config)) },
        ],
      };
    }
    case 'wallet_balance': {
      const result = await withPumpPortal(async (pump) => {
        const balance = await pump.getBalance();
        return { wallet: pump.getWalletAddress(), balance };
      });

      return {
        content: [
          { type: 'text', text: formatJson(result) },
        ],
      };
    }
    case 'launch_token': {
      const command = buildManualLaunchCommand(args);
      const result = await withPumpPortal(async (pump) => pump.createToken(command));

      eventBus.emit(EventType.TOKEN_CREATED, {
        ticker: command.ticker,
        name: command.name,
        mint: result.mint,
        signature: result.signature,
      });

      return {
        content: [
          {
            type: 'text',
            text: formatJson({
              ticker: command.ticker,
              name: command.name,
              mint: result.mint,
              signature: result.signature,
              pumpfun: `https://pump.fun/${result.mint}`,
            }),
          },
        ],
      };
    }
    case 'buy_token': {
      const mint = String(args.mint || '').trim();
      const amountSol = typeof args.amountSol === 'number' ? args.amountSol : Number(args.amountSol);

      if (!mint) {
        throw new Error('mint is required');
      }
      if (!amountSol || Number.isNaN(amountSol) || amountSol <= 0) {
        throw new Error('amountSol must be a positive number');
      }

      const signature = await withPumpPortal(async (pump) => pump.buyToken(mint, amountSol));

      eventBus.emit(EventType.TX_CONFIRMED, {
        ticker: mint,
        name: 'buy',
      });

      return {
        content: [
          { type: 'text', text: formatJson({ mint, amountSol, signature }) },
        ],
      };
    }
    case 'event_history': {
      const limit = typeof args.limit === 'number' ? args.limit : Number(args.limit) || 20;
      const events = eventBus.getHistory(limit).map((evt) => ({
        id: evt.id,
        type: evt.type,
        timestamp: evt.timestamp,
        data: evt.data,
      }));

      return {
        content: [
          { type: 'text', text: formatJson(events) },
        ],
      };
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: getResourceList(),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest): Promise<any> => {
  const uri = request.params.uri.replace(/^file:/, '');
  const filePath = path.join(process.cwd(), uri);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Resource not found: ${uri}`);
  }

  const text = fs.readFileSync(filePath, 'utf-8');

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: uri.endsWith('.md') ? 'text/markdown' : 'text/plain',
        text,
      },
    ],
  };
});

async function withPumpPortal<T>(
  fn: (pump: PumpPortalService, config: FullConfig) => Promise<T>
): Promise<T> {
  const config = loadConfig();
  const pump = new PumpPortalService(config.solana, config.tokenDefaults, null);
  return fn(pump, config);
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('MCP server started (stdio transport)');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
