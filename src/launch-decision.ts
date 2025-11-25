import { LaunchCandidate } from './types';

interface LaunchPolicy {
  minScore?: number; // 1-10
  minConfidence?: number; // 0-1
  blockRiskFlags?: string[];
  allowNSFW?: boolean;
}

const DEFAULT_POLICY: Required<LaunchPolicy> = {
  minScore: 8,
  minConfidence: 0.65,
  blockRiskFlags: ['political', 'tragedy', 'brand_like_ticker'],
  allowNSFW: false,
};

export function shouldLaunch(candidate: LaunchCandidate, policy: LaunchPolicy = {}): boolean {
  const resolved = { ...DEFAULT_POLICY, ...policy };
  const analysis = candidate.analysis;

  if (!analysis.shouldLaunch) return false;
  if (!resolved.allowNSFW && analysis.nsfwOrSensitive) return false;
  if (analysis.score1to10 < resolved.minScore) return false;
  if (analysis.confidence < resolved.minConfidence) return false;

  if (analysis.riskFlags.some(flag => resolved.blockRiskFlags.includes(flag))) {
    return false;
  }

  return true;
}
