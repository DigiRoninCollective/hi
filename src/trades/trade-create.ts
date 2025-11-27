import 'dotenv/config';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import { readFile } from 'fs/promises';
import { fetch, FormData } from 'undici';
import { Blob } from 'buffer';
import { loadKeypairFromEnv } from '../utils/secure-wallet';

const IMAGE_PATH = process.env.TOKEN_IMAGE_PATH || './example.png';
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function sendCreateTx(): Promise<void> {
  const creator = loadKeypairFromEnv();
  const connection = new Connection(RPC_ENDPOINT, 'confirmed');

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

  // Request a locally signable transaction from PumpPortal
  const response = await fetch('https://pumpportal.fun/api/trade-local', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      publicKey: creator.publicKey.toBase58(),
      tokenMetadata: {
        name: metadataResponseJSON.metadata.name,
        symbol: metadataResponseJSON.metadata.symbol,
        uri: metadataResponseJSON.metadataUri,
      },
      mint: mintKeypair.publicKey.toBase58(),
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

  const tx = VersionedTransaction.deserialize(new Uint8Array(await response.arrayBuffer()));
  tx.sign([mintKeypair, creator]);

  const signature = await connection.sendTransaction(tx, {
    skipPreflight: false,
    preflightCommitment: 'confirmed',
    maxRetries: 3,
  });
  await connection.confirmTransaction(signature, 'confirmed');

  console.log('Mint:', mintKeypair.publicKey.toBase58());
  console.log('Transaction:', `https://solscan.io/tx/${signature}`);
}

sendCreateTx().catch((err) => {
  console.error(err);
  process.exit(1);
});
