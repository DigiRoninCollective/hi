import 'dotenv/config';
import { Blob } from 'buffer';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'path';
import { readFile } from 'fs/promises';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { fetch, FormData } from 'undici';

export type Mode = 'trade' | 'local';

export interface Answers {
  mode: Mode;
  apiKey?: string;
  privateKey?: string;
  publicKey?: string;
  rpcUrl?: string;
  imagePath: string;
  name: string;
  symbol: string;
  description: string;
  amount: number;
  priorityFee: number;
  slippage: number;
  mayhem: boolean;
}

async function ask(prompt: string, defaults?: string): Promise<string> {
  const rl = createInterface({ input, output });
  const full = defaults ? `${prompt} (${defaults}): ` : `${prompt}: `;
  const answer = (await rl.question(full)).trim();
  rl.close();
  return answer.length === 0 && defaults ? defaults : answer;
}

async function askYesNo(prompt: string, defaultValue: boolean): Promise<boolean> {
  const defaults = defaultValue ? 'Y/n' : 'y/N';
  const rl = createInterface({ input, output });
  const answer = (await rl.question(`${prompt} (${defaults}): `)).trim().toLowerCase();
  rl.close();
  if (!answer) return defaultValue;
  return ['y', 'yes'].includes(answer);
}

async function gatherAnswers(): Promise<Answers> {
  const modeInput = (await ask('Mode [trade/local]', 'trade')).toLowerCase();
  const mode: Mode = modeInput === 'local' ? 'local' : 'trade';

  const name = await ask('Token name', 'PPTest');
  const symbol = await ask('Token symbol', 'TEST');
  const description = await ask('Description', 'This is an example token created via PumpPortal.fun');
  const imagePath = await ask('Image path', process.env.TOKEN_IMAGE_PATH || './example.png');
  const amount = Number(await ask('Initial buy amount in SOL', '1'));
  const priorityFee = Number(await ask('Priority fee (SOL)', '0.0005'));
  const slippage = Number(await ask('Slippage (bps)', '10'));
  const mayhem = await askYesNo('Enable Mayhem Mode?', false);

  if (mode === 'trade') {
    const apiKey = await ask('PumpPortal API key', process.env.PUMPPORTAL_API_KEY || '');
    return { mode, apiKey, imagePath, name, symbol, description, amount, priorityFee, slippage, mayhem };
  }

  const privateKey = await ask('Solana private key (base58)', process.env.SOLANA_PRIVATE_KEY || '');
  const publicKey = await ask('Solana public key (base58)', process.env.SOLANA_PUBLIC_KEY || '');
  const rpcUrl = await ask('RPC URL', process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');
  return { mode, privateKey, publicKey, rpcUrl, imagePath, name, symbol, description, amount, priorityFee, slippage, mayhem };
}

export async function uploadMetadata(
  imagePath: string,
  name: string,
  symbol: string,
  description: string
): Promise<{ name: string; symbol: string; uri: string }> {
  const imageBuffer = await readFile(imagePath);
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), path.basename(imagePath));
  formData.append('name', name);
  formData.append('symbol', symbol);
  formData.append('description', description);
  formData.append('website', 'https://pumpportal.fun');
  formData.append('showName', 'true');

  const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
    method: 'POST',
    body: formData,
  });

  if (!metadataResponse.ok) {
    throw new Error(`IPFS upload failed: ${metadataResponse.status} ${await metadataResponse.text()}`);
  }

  const metadataResponseJSON = await metadataResponse.json() as any;
  return {
    name: metadataResponseJSON.metadata.name,
    symbol: metadataResponseJSON.metadata.symbol,
    uri: metadataResponseJSON.metadataUri,
  };
}

export async function runTradeFlow(answers: Answers): Promise<void> {
  if (!answers.apiKey) throw new Error('PumpPortal API key is required.');

  const mintKeypair = Keypair.generate();
  const tokenMetadata = await uploadMetadata(answers.imagePath, answers.name, answers.symbol, answers.description);

  const response = await fetch(`https://pumpportal.fun/api/trade?api-key=${answers.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      tokenMetadata,
      mint: bs58.encode(mintKeypair.secretKey),
      denominatedInSol: true,
      amount: answers.amount,
      slippage: answers.slippage,
      priorityFee: answers.priorityFee,
      pool: 'pump',
      isMayhemMode: answers.mayhem,
    }),
  });

  if (!response.ok) {
    throw new Error(`trade create failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as any;
  console.log('Mint:', mintKeypair.publicKey.toBase58());
  console.log('Transaction:', `https://solscan.io/tx/${data.signature}`);
}

export async function runLocalFlow(answers: Answers): Promise<void> {
  if (!answers.privateKey) throw new Error('SOLANA_PRIVATE_KEY is required.');
  const signerKeyPair = Keypair.fromSecretKey(bs58.decode(answers.privateKey));
  const publicKey = answers.publicKey || signerKeyPair.publicKey.toBase58();
  const connection = new Connection(answers.rpcUrl || 'https://api.mainnet-beta.solana.com', 'confirmed');

  const mintKeypair = Keypair.generate();
  const tokenMetadata = await uploadMetadata(answers.imagePath, answers.name, answers.symbol, answers.description);

  const response = await fetch('https://pumpportal.fun/api/trade-local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      action: 'create',
      tokenMetadata: {
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        uri: tokenMetadata.uri,
      },
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: true,
      amount: answers.amount,
      slippage: answers.slippage,
      priorityFee: answers.priorityFee,
      pool: 'pump',
      isMayhemMode: answers.mayhem,
    }),
  });

  if (!response.ok) {
    throw new Error(`trade-local failed: ${response.status} ${await response.text()}`);
  }

  const tx = VersionedTransaction.deserialize(new Uint8Array(await response.arrayBuffer()));
  tx.sign([mintKeypair, signerKeyPair]);

  const signature = await connection.sendTransaction(tx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  await connection.confirmTransaction(signature, 'confirmed');

  console.log('Mint:', mintKeypair.publicKey.toBase58());
  console.log('Transaction:', `https://solscan.io/tx/${signature}`);
}

async function main(): Promise<void> {
  const answers = await gatherAnswers();
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
