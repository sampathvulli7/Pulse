import { Track } from '../types/audio';

/**
 * 1. Pure Fisher-Yates (Knuth) Shuffle
 * Uniformly distributed random permutation O(N) with strict zero algorithmic bias.
 */
export function pureFisherYatesShuffle<T>(array: T[], rng: () => number = Math.random): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Cycle-aware Fisher-Yates state tracker ensuring zero repeats until full cycle completion.
 */
export class NonRepeatingShuffleCycle<T extends { id: string }> {
  private originalPool: T[] = [];
  private unplayedPool: T[] = [];
  private playedHistory: T[] = [];

  constructor(items: T[] = []) {
    this.setPool(items);
  }

  public setPool(items: T[]) {
    this.originalPool = [...items];
    this.resetCycle();
  }

  public resetCycle() {
    this.unplayedPool = pureFisherYatesShuffle(this.originalPool);
    this.playedHistory = [];
  }

  public next(): T | null {
    if (this.unplayedPool.length === 0) {
      if (this.originalPool.length === 0) return null;
      // Cycle exhausted: re-shuffle pool for next cycle
      this.resetCycle();
    }
    const track = this.unplayedPool.shift()!;
    this.playedHistory.push(track);
    return track;
  }

  public getRemainingCount(): number {
    return this.unplayedPool.length;
  }

  public getUnplayedPool(): T[] {
    return [...this.unplayedPool];
  }
}

/**
 * 2. Artist-Spread Shuffle
 * Prevents songs by the same artist from clustering back-to-back.
 * Groups by artist, sorts buckets by size, and round-robins with randomized displacement.
 */
export function artistSpreadShuffle(tracks: Track[], rng: () => number = Math.random): Track[] {
  if (tracks.length <= 2) return pureFisherYatesShuffle(tracks, rng);

  // Group by artist (normalized)
  const artistMap = new Map<string, Track[]>();
  for (const track of tracks) {
    const artist = (track.artist || 'Unknown').trim().toLowerCase();
    if (!artistMap.has(artist)) {
      artistMap.set(artist, []);
    }
    artistMap.get(artist)!.push(track);
  }

  // Shuffle tracks within each artist bucket
  for (const [artist, bucket] of artistMap.entries()) {
    artistMap.set(artist, pureFisherYatesShuffle(bucket, rng));
  }

  // Sort buckets by size descending
  const buckets = Array.from(artistMap.values()).sort((a, b) => b.length - a.length);

  // Interleave using max spacing
  const result: Track[] = [];
  let remaining = true;

  while (remaining) {
    remaining = false;
    for (const bucket of buckets) {
      if (bucket.length > 0) {
        result.push(bucket.shift()!);
        remaining = true;
      }
    }
  }

  // Post-processing pass: if two identical artists are adjacent, swap with next non-matching
  for (let i = 0; i < result.length - 1; i++) {
    if (result[i].artist.toLowerCase() === result[i + 1].artist.toLowerCase()) {
      for (let j = i + 2; j < result.length; j++) {
        if (
          result[j].artist.toLowerCase() !== result[i].artist.toLowerCase() &&
          (j === result.length - 1 || result[j].artist.toLowerCase() !== result[j + 1].artist.toLowerCase())
        ) {
          [result[i + 1], result[j]] = [result[j], result[i + 1]];
          break;
        }
      }
    }
  }

  return result;
}

/**
 * 3. Mood / Tempo Flow Shuffle
 * Orders tracks along a smooth BPM / Energy trajectory.
 * Minimizes abrupt tempo jumps and energy discontinuities.
 */
export function bpmEnergyFlowShuffle(tracks: Track[]): Track[] {
  if (tracks.length <= 2) return [...tracks];

  // Helper cost function between track A and track B
  const transitionCost = (a: Track, b: Track): number => {
    const bpmA = a.bpm || 110;
    const bpmB = b.bpm || 110;
    const energyA = a.energy ?? 0.5;
    const energyB = b.energy ?? 0.5;

    // Normalized BPM delta + Energy delta
    const bpmDelta = Math.abs(bpmA - bpmB) / 100;
    const energyDelta = Math.abs(energyA - energyB);

    return bpmDelta * 0.6 + energyDelta * 0.4;
  };

  // Greedy Nearest Neighbor path with random starting track
  const unvisited = [...tracks];
  const startIdx = Math.floor(Math.random() * unvisited.length);
  const result: Track[] = [unvisited.splice(startIdx, 1)[0]];

  while (unvisited.length > 0) {
    const current = result[result.length - 1];
    let bestIdx = 0;
    let minCost = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const cost = transitionCost(current, unvisited[i]);
      if (cost < minCost) {
        minCost = cost;
        bestIdx = i;
      }
    }

    result.push(unvisited.splice(bestIdx, 1)[0]);
  }

  return result;
}
