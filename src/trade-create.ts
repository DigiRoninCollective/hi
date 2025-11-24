import 'dotenv/config';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { readFile } from 'fs/promises';
import { fetch, FormData } from 'undici';
import { Blob } from 'buffer';

const API_KEY = process.env.PUMPPORTAL_API_KEY;
const IMAGE_PATH = process.env.TOKEN_IMAGE_PATH || './example.png';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function sendCreateTx(): Promise<void> {
  // Generate a random keypair for token
  const mintKeypair = Keypair.generate();

  // Define token metadata
  const imageBuffer = await readFile(IMAGE_PATH);
  const formData = new FormData();
  formData.append('file', new Blob([imageBuffer], { type: 'image/png' }), IMAGE_PATH.split('/').pop() || 'image.png');
  formData.append('name', 'PPTest');
  formData.append('symbol', 'TEST');
  formData.append('description', 'This is an example token created via PumpPortal.fun');
  formData.append('twitter', 'https://x.com/a1lon9/status/1812970586420994083');
  formData.append('telegram', 'https://x.com/a1lon9/status/1812970586420994083');
  formData.append('website', 'https://pumpportal.fun');
  formData.append('showName', 'true');

  // Create IPFS metadata storage
  const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
    method: 'POST',
    body: formData,
  });

  if (!metadataResponse.ok) {
    throw new Error(`IPFS upload failed: ${metadataResponse.status} ${await metadataResponse.text()}`);
  }

  const metadataResponseJSON = await metadataResponse.json() as any;

  // Send the create transaction via PumpPortal trade API
  const response = await fetch(`https://pumpportal.fun/api/trade?api-key=${requireEnv('PUMPPORTAL_API_KEY', API_KEY)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      tokenMetadata: {
        name: metadataResponseJSON.metadata.name,
        symbol: metadataResponseJSON.metadata.symbol,
        uri: metadataResponseJSON.metadataUri,
      },
      mint: bs58.encode(mintKeypair.secretKey),
      denominatedInSol: true,
      amount: 1, // Dev buy of 1 SOL
      slippage: 10,
      priorityFee: 0.0005,
      pool: 'pump',
      isMayhemMode: false, // optional, defaults to false
    }),
  });

  if (!response.ok) {
    throw new Error(`trade create failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as any;
  console.log('Mint:', mintKeypair.publicKey.toBase58());
  console.log('Transaction:', `https://solscan.io/tx/${data.signature}`);
}

sendCreateTx().catch((err) => {
  console.error(err);
  process.exit(1);
});
