import { LaunchCandidate, ParsedLaunchCommand } from './types';

type LaunchStatus =
  | 'candidate'
  | 'queued'
  | 'launched'
  | 'skipped-classifier'
  | 'skipped-policy'
  | 'skipped-manual'
  | 'analysis-missing'
  | 'failed';

interface CachedLaunch {
  candidate: LaunchCandidate;
  command: ParsedLaunchCommand;
  status: LaunchStatus;
  updatedAt: number;
}

const launchCache = new Map<string, CachedLaunch>();

export function upsertLaunchCandidate(tweetId: string, candidate: LaunchCandidate, command: ParsedLaunchCommand, status: LaunchStatus = 'candidate'): void {
  launchCache.set(tweetId, {
    candidate,
    command,
    status,
    updatedAt: Date.now(),
  });
}

export function updateLaunchStatus(tweetId: string, status: LaunchStatus): void {
  const existing = launchCache.get(tweetId);
  if (existing) {
    existing.status = status;
    existing.updatedAt = Date.now();
    launchCache.set(tweetId, existing);
  }
}

export function getLaunchCandidate(tweetId: string): CachedLaunch | null {
  return launchCache.get(tweetId) || null;
}

export function listLaunchCandidates(): CachedLaunch[] {
  return Array.from(launchCache.values());
}
