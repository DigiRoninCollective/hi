import 'dotenv/config';
import prompts from 'prompts';
import { runLocalFlow, runTradeFlow, Answers, Mode } from './trade-wizard';

function onCancel(): never {
  console.log('Cancelled.');
  process.exit(1);
}

function requireNumber(value: string, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function main(): Promise<void> {
  const response = await prompts(
    [
      {
        type: 'select',
        name: 'mode',
        message: 'Mode',
        choices: [
          { title: 'Trade (API signs)', value: 'trade' },
          { title: 'Local (your wallet signs)', value: 'local' },
        ],
        initial: 0,
      },
      {
        type: (prev: Mode) => (prev === 'trade' ? 'text' : null),
        name: 'apiKey',
        message: 'PumpPortal API key',
        initial: process.env.PUMPPORTAL_API_KEY || '',
      },
      {
        type: (prev: Mode) => (prev === 'local' ? 'password' : null),
        name: 'privateKey',
        message: 'Solana private key (base58)',
        initial: process.env.SOLANA_PRIVATE_KEY || '',
      },
      {
        type: (prev: Mode) => (prev === 'local' ? 'text' : null),
        name: 'publicKey',
        message: 'Solana public key (base58)',
        initial: process.env.SOLANA_PUBLIC_KEY || '',
      },
      {
        type: (prev: Mode) => (prev === 'local' ? 'text' : null),
        name: 'rpcUrl',
        message: 'RPC URL',
        initial: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      },
      {
        type: 'text',
        name: 'name',
        message: 'Token name',
        initial: 'PPTest',
      },
      {
        type: 'text',
        name: 'symbol',
        message: 'Token symbol',
        initial: 'TEST',
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description',
        initial: 'This is an example token created via PumpPortal.fun',
      },
      {
        type: 'text',
        name: 'imagePath',
        message: 'Image path',
        initial: process.env.TOKEN_IMAGE_PATH || './example.png',
      },
      {
        type: 'text',
        name: 'amount',
        message: 'Initial buy amount in SOL',
        initial: '1',
      },
      {
        type: 'text',
        name: 'priorityFee',
        message: 'Priority fee (SOL)',
        initial: '0.0005',
      },
      {
        type: 'text',
        name: 'slippage',
        message: 'Slippage (bps)',
        initial: '10',
      },
      {
        type: 'toggle',
        name: 'mayhem',
        message: 'Enable Mayhem Mode?',
        initial: false,
        active: 'yes',
        inactive: 'no',
      },
    ],
    { onCancel }
  );

  const answers: Answers = {
    mode: response.mode,
    apiKey: response.apiKey,
    privateKey: response.privateKey,
    publicKey: response.publicKey,
    rpcUrl: response.rpcUrl,
    imagePath: response.imagePath,
    name: response.name,
    symbol: response.symbol,
    description: response.description,
    amount: requireNumber(response.amount, 1),
    priorityFee: requireNumber(response.priorityFee, 0.0005),
    slippage: requireNumber(response.slippage, 10),
    mayhem: response.mayhem,
  };

  if (answers.mode === 'trade') {
    await runTradeFlow(answers);
  } else {
    await runLocalFlow(answers);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
