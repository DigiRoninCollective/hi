import 'dotenv/config';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import { readFile } from 'fs/promises';
import { Blob } from 'buffer';
import { loadKeypairFromEnv } from '../utils/secure-wallet';

const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const IMAGE_PATH = process.env.TOKEN_IMAGE_PATH || './example.png';

async function sendLocalCreateTx(): Promise<void> {
  const signerKeyPair = loadKeypairFromEnv();
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
      publicKey: signerKeyPair.publicKey.toBase58(),
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
