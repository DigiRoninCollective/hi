import fs from 'fs';
import path from 'path';
// @ts-ignore - snarkjs lacks type definitions
import { groth16 } from 'snarkjs';
import { ZkMixerConfig } from './types';

export interface ZkProofRequest {
  proof: any;
  publicSignals: {
    merkle_root: string;
    nullifier_hash: string;
    recipient: string;
  };
}

export interface ZkProofResult {
  merkleRoot: string;
  nullifierHash: string;
  recipient: string;
}

export class ZkMixerService {
  private config: ZkMixerConfig;
  private verificationKey: any;
  private usedNullifiers: Set<string> = new Set();

  constructor(config: ZkMixerConfig) {
    this.config = config;

    const vkPath = path.join(this.config.artifactDir, 'verification_key.json');
    if (!fs.existsSync(vkPath)) {
      throw new Error(`Verification key not found at ${vkPath}`);
    }
    this.verificationKey = JSON.parse(fs.readFileSync(vkPath, 'utf-8'));

    // Load nullifier store if present
    if (this.config.nullifierStorePath && fs.existsSync(this.config.nullifierStorePath)) {
      try {
        const stored = JSON.parse(fs.readFileSync(this.config.nullifierStorePath, 'utf-8'));
        if (Array.isArray(stored)) {
          stored.forEach((n) => this.usedNullifiers.add(String(n)));
        }
      } catch (err) {
        console.warn('Failed to load nullifier store; starting empty:', err);
      }
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  async verifyAndConsume({ proof, publicSignals }: ZkProofRequest): Promise<ZkProofResult> {
    if (!this.config.enabled) {
      throw new Error('ZkMixerService disabled');
    }

    const normalizedSignals = this.normalizeSignals(publicSignals);
    const { nullifierHash, merkleRoot, recipient } = normalizedSignals;

    if (this.usedNullifiers.has(nullifierHash)) {
      throw new Error('Nullifier already used');
    }

    const signalsArray = [merkleRoot, nullifierHash, recipient];
    const ok = await groth16.verify(this.verificationKey, signalsArray, proof);
    if (!ok) {
      throw new Error('Invalid Groth16 proof');
    }

    this.usedNullifiers.add(nullifierHash);
    this.persistNullifiers();

    return { merkleRoot, nullifierHash, recipient };
  }

  private normalizeSignals(publicSignals: ZkProofRequest['publicSignals']): ZkProofResult {
    const toDecimalString = (value: string): string => {
      if (value.startsWith('0x') || value.startsWith('0X')) {
        return BigInt(value).toString();
      }
      return value;
    };

    return {
      merkleRoot: toDecimalString(publicSignals.merkle_root),
      nullifierHash: toDecimalString(publicSignals.nullifier_hash),
      recipient: toDecimalString(publicSignals.recipient),
    };
  }

  private persistNullifiers(): void {
    if (!this.config.nullifierStorePath) return;
    try {
      fs.writeFileSync(this.config.nullifierStorePath, JSON.stringify(Array.from(this.usedNullifiers), null, 2));
    } catch (err) {
      console.warn('Failed to persist nullifier store:', err);
    }
  }
}
