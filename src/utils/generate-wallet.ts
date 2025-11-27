import { Connection, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates a fresh Solana keypair. Optionally funds it from FUNDING_PRIVATE_KEY.
 *
 * Env vars:
 * - SOLANA_RPC_URL: RPC endpoint (default: https://api.mainnet-beta.solana.com)
 * - FUNDING_PRIVATE_KEY: base58 secret key used to fund the new wallet (optional)
 * - FUNDING_LAMPORTS: lamports to send (default: 1_000_000 = 0.001 SOL)
 */
async function main() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const fundingSk = process.env.FUNDING_PRIVATE_KEY;
  const fundingLamports = parseInt(process.env.FUNDING_LAMPORTS || '1000000', 10);

  const connection = new Connection(rpcUrl, 'confirmed');

  // Generate fresh wallet
  const fresh = Keypair.generate();
  const publicKeyBase58 = fresh.publicKey.toBase58();
  const secretKeyBase58 = bs58.encode(fresh.secretKey);

  console.log('New wallet created');
  console.log(`Public Key:  ${publicKeyBase58}`);
  console.log(`Secret Key:  ${secretKeyBase58}`);

  if (!fundingSk) {
    console.log('\nNo FUNDING_PRIVATE_KEY set; wallet not funded.');
    return;
  }

  try {
    const funder = Keypair.fromSecretKey(bs58.decode(fundingSk));
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: fresh.publicKey,
        lamports: fundingLamports,
      })
    );

    const sig = await sendAndConfirmTransaction(connection, tx, [funder]);
    console.log('\nFunding transaction sent');
    console.log(`Signature: https://solscan.io/tx/${sig}`);
    console.log(`Amount: ${(fundingLamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
  } catch (err) {
    console.error('\nFunding failed:', err);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
