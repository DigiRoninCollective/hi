import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * MintKeyManager
 * Manages creation, persistence, and recovery of mint keypairs for tokens
 * Prevents loss of token keys and enables audit trails
 */
export class MintKeyManager {
  private db: any; // Supabase client or null

  constructor(db?: any) {
    this.db = db || null;
  }

  /**
   * Create and persist a new mint keypair
   */
  async createAndSaveMintKey(
    tokenName: string,
    tokenSymbol: string,
    contractAddress?: string,
    createdBy?: string
  ): Promise<Keypair> {
    const mintKeypair = Keypair.generate();

    // Save to database for recovery if Supabase is configured
    if (this.db) {
      try {
        const { data, error } = await this.db
          .from('mint_keys')
          .insert({
            mint_address: mintKeypair.publicKey.toBase58(),
            secret_key_bs58: bs58.encode(mintKeypair.secretKey),
            token_name: tokenName,
            token_symbol: tokenSymbol,
            contract_address: contractAddress || null,
            created_by: createdBy || null,
            created_at: new Date().toISOString(),
            status: 'pending',
          })
          .select();

        if (error) {
          console.error('Failed to save mint key:', error);
          // Don't throw - continue anyway, just won't have backup
        } else {
          console.log(`[MintKeyManager] Mint key saved to database: ${mintKeypair.publicKey.toBase58()}`);
        }
      } catch (err) {
        console.error('Error saving mint key:', err);
        // Continue anyway - token creation is more important than backup
      }
    }

    return mintKeypair;
  }

  /**
   * Recover mint keypair from database by mint address
   */
  async recoverMintKey(mintAddress: string): Promise<Keypair> {
    if (!this.db) {
      throw new Error('Database not configured for key recovery');
    }

    try {
      const { data, error } = await this.db
        .from('mint_keys')
        .select('secret_key_bs58')
        .eq('mint_address', mintAddress)
        .single();

      if (error || !data) {
        throw new Error(`Mint key not found for address: ${mintAddress}`);
      }

      const keypair = Keypair.fromSecretKey(bs58.decode(data.secret_key_bs58));
      console.log(`[MintKeyManager] Recovered mint key: ${mintAddress}`);
      return keypair;
    } catch (err: any) {
      throw new Error(`Failed to recover mint key: ${err.message}`);
    }
  }

  /**
   * Mark token as confirmed after successful creation
   */
  async markTokenConfirmed(
    mintAddress: string,
    signature: string,
    contractAddress?: string
  ): Promise<void> {
    if (!this.db) {
      return; // Silent return if no DB
    }

    try {
      const updateData: any = {
        status: 'confirmed',
        creation_signature: signature,
        confirmed_at: new Date().toISOString(),
      };

      if (contractAddress) {
        updateData.contract_address = contractAddress;
      }

      const { error } = await this.db
        .from('mint_keys')
        .update(updateData)
        .eq('mint_address', mintAddress);

      if (error) {
        console.error('Failed to mark token confirmed:', error);
      } else {
        console.log(`[MintKeyManager] Token marked confirmed: ${mintAddress}`);
      }
    } catch (err) {
      console.error('Error marking token confirmed:', err);
    }
  }

  /**
   * Get all mint keys for a user (with optional filtering)
   */
  async getUserMintKeys(
    userId: string,
    status?: 'pending' | 'confirmed' | 'failed'
  ): Promise<any[]> {
    if (!this.db) {
      return [];
    }

    try {
      let query = this.db
        .from('mint_keys')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch mint keys:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error fetching mint keys:', err);
      return [];
    }
  }

  /**
   * Mark token as failed (if creation failed)
   */
  async markTokenFailed(mintAddress: string, errorMessage: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const { error } = await this.db
        .from('mint_keys')
        .update({
          status: 'failed',
          error_message: errorMessage,
          failed_at: new Date().toISOString(),
        })
        .eq('mint_address', mintAddress);

      if (error) {
        console.error('Failed to mark token failed:', error);
      }
    } catch (err) {
      console.error('Error marking token failed:', err);
    }
  }

  /**
   * Get mint key details
   */
  async getMintKeyDetails(mintAddress: string): Promise<any> {
    if (!this.db) {
      throw new Error('Database not configured');
    }

    try {
      const { data, error } = await this.db
        .from('mint_keys')
        .select('*')
        .eq('mint_address', mintAddress)
        .single();

      if (error || !data) {
        throw new Error(`Mint key details not found: ${mintAddress}`);
      }

      // Don't return secret key to client
      const { secret_key_bs58, ...safeData } = data;
      return safeData;
    } catch (err: any) {
      throw new Error(`Failed to get mint key details: ${err.message}`);
    }
  }

  /**
   * Delete mint key record (for cleanup)
   */
  async deleteMintKey(mintAddress: string): Promise<void> {
    if (!this.db) {
      return;
    }

    try {
      const { error } = await this.db
        .from('mint_keys')
        .delete()
        .eq('mint_address', mintAddress);

      if (error) {
        console.error('Failed to delete mint key:', error);
      } else {
        console.log(`[MintKeyManager] Mint key deleted: ${mintAddress}`);
      }
    } catch (err) {
      console.error('Error deleting mint key:', err);
    }
  }
}
