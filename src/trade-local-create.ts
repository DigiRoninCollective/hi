import 'dotenv/config';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { readFile } from 'fs/promises';
import { Blob } from 'buffer';

const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const PRIVATE_KEY = process.env.SOLANA_PRIVATE_KEY;
const PUBLIC_KEY = process.env.SOLANA_PUBLIC_KEY;
const IMAGE_PATH = process.env.TOKEN_IMAGE_PATH || './example.png';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

async function sendLocalCreateTx(): Promise<void> {
  const signerKeyPair = Keypair.fromSecretKey(bs58.decode(requireEnv('SOLANA_PRIVATE_KEY', PRIVATE_KEY)));
  const web3Connection = new Connection(RPC_ENDPOINT, 'confirmed');

  // Generate a random keypair for token mint
  const mintKeypair = Keypair.generate();

  // Prepare metadata upload with an image
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

  const metadataResponse = await fetch('https://pump.fun/api/ipfs', {
    method: 'POST',
    body: formData,
  });

  if (!metadataResponse.ok) {
    throw new Error(`IPFS upload failed: ${metadataResponse.status} ${await metadataResponse.text()}`);
  }

  const metadataResponseJSON = await metadataResponse.json() as any;

  const response = await fetch('https://pumpportal.fun/api/trade-local', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publicKey: requireEnv('SOLANA_PUBLIC_KEY', PUBLIC_KEY),
      action: 'create',
      tokenMetadata: {
        name: metadataResponseJSON.metadata.name,
        symbol: metadataResponseJSON.metadata.symbol,
        uri: metadataResponseJSON.metadataUri,
      },
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: true,
      amount: 1, // dev buy of 1 SOL
      slippage: 10,
      priorityFee: 0.0005,
      pool: 'pump',
      isMayhemMode: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`trade-local failed: ${response.status} ${await response.text()}`);
  }

  const tx = VersionedTransaction.deserialize(new Uint8Array(await response.arrayBuffer()));
  tx.sign([mintKeypair, signerKeyPair]);

  const signature = await web3Connection.sendTransaction(tx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  await web3Connection.confirmTransaction(signature, 'confirmed');

  console.log('Mint address:', mintKeypair.publicKey.toBase58());
  console.log('Transaction:', `https://solscan.io/tx/${signature}`);
}

sendLocalCreateTx().catch((err) => {
  console.error(err);
  process.exit(1);
});
