import { describe, it, expect, beforeEach } from 'vitest';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types/audio';

const mockTrack = (id: string, artist: string = 'Artist'): Track => ({
  id,
  title: `Track ${id}`,
  artist,
  durationSeconds: 180,
  sourceType: 'local',
  playCount: 0,
  skipCount: 0,
});

describe('Dual-Layer Queue State Engine', () => {
  beforeEach(() => {
    usePlayerStore.setState({
      priorityQueue: [],
      contextQueue: [],
      originalContextQueue: [],
      currentTrack: null,
      history: [],
      isPlaying: false,
    });
  });

  it('plays from Priority Queue before Context Queue on nextTrack()', async () => {
    const t1 = mockTrack('t1');
    const t2 = mockTrack('t2');
    const priorityTrack = mockTrack('p1', 'Special Guest');

    usePlayerStore.setState({
      currentTrack: t1,
      contextQueue: [t2],
      priorityQueue: [priorityTrack],
    });

    await usePlayerStore.getState().nextTrack();

    // Priority track must become currentTrack
    expect(usePlayerStore.getState().currentTrack?.id).toBe('p1');
    // Priority queue should have popped the track
    expect(usePlayerStore.getState().priorityQueue.length).toBe(0);
    // Context queue remains intact for subsequent play
    expect(usePlayerStore.getState().contextQueue.length).toBe(1);
    expect(usePlayerStore.getState().contextQueue[0].id).toBe('t2');
  });

  it('resumes Context Queue once Priority Queue is exhausted', async () => {
    const p1 = mockTrack('p1');
    const c1 = mockTrack('c1');

    usePlayerStore.setState({
      currentTrack: mockTrack('curr'),
      priorityQueue: [p1],
      contextQueue: [c1],
    });

    // 1st skip: consumes p1
    await usePlayerStore.getState().nextTrack();
    expect(usePlayerStore.getState().currentTrack?.id).toBe('p1');

    // 2nd skip: priority queue is empty, consumes c1 from context queue
    await usePlayerStore.getState().nextTrack();
    expect(usePlayerStore.getState().currentTrack?.id).toBe('c1');
    expect(usePlayerStore.getState().contextQueue.length).toBe(0);
  });

  it('supports drag-and-drop reordering within Priority Queue', () => {
    const p1 = mockTrack('p1');
    const p2 = mockTrack('p2');
    const p3 = mockTrack('p3');

    usePlayerStore.setState({ priorityQueue: [p1, p2, p3] });

    // Move index 2 (p3) to index 0
    usePlayerStore.getState().reorderPriorityQueue(2, 0);

    const reordered = usePlayerStore.getState().priorityQueue;
    expect(reordered.map((t) => t.id)).toEqual(['p3', 'p1', 'p2']);
  });

  it('promotes track from Context Queue to Priority Queue', () => {
    const c1 = mockTrack('c1');
    const c2 = mockTrack('c2');

    usePlayerStore.setState({
      priorityQueue: [],
      contextQueue: [c1, c2],
    });

    // Move c2 to priority
    usePlayerStore.getState().moveContextToPriority(1);

    expect(usePlayerStore.getState().priorityQueue.length).toBe(1);
    expect(usePlayerStore.getState().priorityQueue[0].id).toBe('c2');
    expect(usePlayerStore.getState().contextQueue.length).toBe(1);
    expect(usePlayerStore.getState().contextQueue[0].id).toBe('c1');
  });

  it('provides instant feedback on rapid play/pause successive clicks without state desync', () => {
    const t1 = mockTrack('t1');
    usePlayerStore.setState({ currentTrack: t1, isPlaying: false });

    // Click 1: toggle to play
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    // Click 2: toggle to pause immediately
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(false);

    // Click 3: toggle to play again
    usePlayerStore.getState().togglePlay();
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });

  it('seamlessly advances track without race conditions when clicking nextTrack rapidly', async () => {
    const t1 = mockTrack('t1');
    const t2 = mockTrack('t2');
    const t3 = mockTrack('t3');
    const t4 = mockTrack('t4');

    usePlayerStore.setState({
      currentTrack: t1,
      contextQueue: [t2, t3, t4],
      isPlaying: true,
    });

    // Rapid successive nextTrack skips
    await usePlayerStore.getState().nextTrack();
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t2');
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await usePlayerStore.getState().nextTrack();
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t3');
    expect(usePlayerStore.getState().isPlaying).toBe(true);

    await usePlayerStore.getState().nextTrack();
    expect(usePlayerStore.getState().currentTrack?.id).toBe('t4');
    expect(usePlayerStore.getState().isPlaying).toBe(true);
  });
});
