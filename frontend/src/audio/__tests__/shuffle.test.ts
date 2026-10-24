import { describe, it, expect } from 'vitest';
import { pureFisherYatesShuffle, NonRepeatingShuffleCycle, artistSpreadShuffle, bpmEnergyFlowShuffle } from '../shuffle';
import { Track } from '../../types/audio';

const mockTrack = (id: string, artist: string, bpm: number = 120, energy: number = 0.8): Track => ({
  id,
  title: `Track ${id}`,
  artist,
  durationSeconds: 200,
  sourceType: 'local',
  bpm,
  energy,
  playCount: 0,
  skipCount: 0,
});

describe('Deterministic Shuffle Algorithms', () => {
  describe('Pure Fisher-Yates Shuffle', () => {
    it('preserves all items without loss or duplication', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const shuffled = pureFisherYatesShuffle(items);

      expect(shuffled.length).toBe(items.length);
      expect(new Set(shuffled)).toEqual(new Set(items));
    });

    it('NonRepeatingShuffleCycle guarantees zero repeats until cycle completion', () => {
      const tracks = [
        mockTrack('1', 'Artist A'),
        mockTrack('2', 'Artist B'),
        mockTrack('3', 'Artist C'),
        mockTrack('4', 'Artist D'),
        mockTrack('5', 'Artist E'),
      ];

      const tracker = new NonRepeatingShuffleCycle(tracks);
      const playedInCycle1 = new Set<string>();

      // Consume full cycle
      for (let i = 0; i < tracks.length; i++) {
        const next = tracker.next();
        expect(next).not.toBeNull();
        expect(playedInCycle1.has(next!.id)).toBe(false); // Zero repeats in cycle!
        playedInCycle1.add(next!.id);
      }

      expect(playedInCycle1.size).toBe(tracks.length);

      // On next step, cycle restarts with full pool
      const nextCycleTrack = tracker.next();
      expect(nextCycleTrack).not.toBeNull();
      expect(tracker.getRemainingCount()).toBe(tracks.length - 1);
    });
  });

  describe('Artist-Spread Shuffle', () => {
    it('prevents songs by the same artist from clustering back-to-back', () => {
      const tracks = [
        mockTrack('1', 'The Midnight'),
        mockTrack('2', 'The Midnight'),
        mockTrack('3', 'The Midnight'),
        mockTrack('4', 'Arctic Monkeys'),
        mockTrack('5', 'Arctic Monkeys'),
        mockTrack('6', 'Daft Punk'),
        mockTrack('7', 'Muse'),
        mockTrack('8', 'Tool'),
      ];

      const spread = artistSpreadShuffle(tracks);

      expect(spread.length).toBe(tracks.length);
      expect(new Set(spread.map((t) => t.id))).toEqual(new Set(tracks.map((t) => t.id)));

      // Invariant: no two adjacent tracks share the same artist
      for (let i = 0; i < spread.length - 1; i++) {
        expect(spread[i].artist.toLowerCase()).not.toBe(spread[i + 1].artist.toLowerCase());
      }
    });
  });

  describe('BPM / Energy Flow Shuffle', () => {
    it('orders tracks to minimize tempo and energy discontinuities', () => {
      const tracks = [
        mockTrack('1', 'Ambient', 60, 0.2),
        mockTrack('2', 'LoFi', 75, 0.35),
        mockTrack('3', 'House', 124, 0.85),
        mockTrack('4', 'EDM', 128, 0.95),
        mockTrack('5', 'DrumNBass', 170, 0.90),
      ];

      const flow = bpmEnergyFlowShuffle(tracks);

      expect(flow.length).toBe(tracks.length);
      expect(new Set(flow.map((t) => t.id))).toEqual(new Set(tracks.map((t) => t.id)));

      // Calculate total transition delta across flow
      let totalCost = 0;
      for (let i = 0; i < flow.length - 1; i++) {
        const bpmDelta = Math.abs(flow[i].bpm! - flow[i + 1].bpm!);
        const energyDelta = Math.abs(flow[i].energy! - flow[i + 1].energy!);
        totalCost += bpmDelta + energyDelta * 100;
      }

      // In smooth flow, total cost is bounded and coherent
      expect(totalCost).toBeLessThan(350);
    });
  });
});
