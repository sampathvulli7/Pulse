process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../server';
import { db } from '../db/database';
import { evaluateRules } from '../services/smartPlaylistEvaluator';

async function runAllTests() {
  console.log('--- Starting Pulse Backend Test Suite ---');
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(3999, () => {
      console.log('✓ Test server listening on port 3999');
      resolve();
    });
  });

  const baseUrl = 'http://localhost:3999';

  try {
    // 1. Verify 50+ Track Demo Seed
    console.log('\n[Test 1] Verifying 50+ Track Demo Seed in SQLite...');
    const trackCountRow = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number };
    assert(trackCountRow.count >= 50, `Expected at least 50 tracks in seed, got ${trackCountRow.count}`);
    console.log(`✓ Passed: Database contains ${trackCountRow.count} seeded tracks.`);

    // 2. Verify Playlists and Smart Playlists
    console.log('\n[Test 2] Verifying Seeded Playlists and Smart Rules...');
    const playlists = db.prepare('SELECT * FROM playlists').all() as any[];
    assert(playlists.length >= 3, `Expected at least 3 playlists, got ${playlists.length}`);
    const smartPlaylists = playlists.filter((p) => p.is_smart === 1);
    assert(smartPlaylists.length >= 2, `Expected at least 2 smart playlists, got ${smartPlaylists.length}`);
    console.log(`✓ Passed: Verified ${playlists.length} playlists (${smartPlaylists.length} smart playlists).`);

    // 3. Test Smart Playlist SQL Evaluator
    console.log('\n[Test 3] Testing Smart Playlist Evaluator Invariants...');
    const highEnergyTracks = evaluateRules([
      { field: 'energy', operator: 'greater_than', value: '0.80' },
      { field: 'bpm', operator: 'greater_than', value: '110', logic_gate: 'AND' },
    ]);
    assert(highEnergyTracks.length > 0, 'Expected matching high energy tracks');
    for (const t of highEnergyTracks as any[]) {
      assert(t.energy >= 0.80, `Track ${t.title} energy ${t.energy} should be >= 0.80`);
      assert(t.bpm >= 110, `Track ${t.title} bpm ${t.bpm} should be >= 110`);
    }
    console.log(`✓ Passed: Evaluator correctly resolved ${highEnergyTracks.length} high-energy tracks.`);

    // 4. Test HTTP 206 Partial Content Audio Streaming
    console.log('\n[Test 4] Testing HTTP 206 Partial Content Byte-Range Streaming...');
    const localTrack = db.prepare("SELECT * FROM tracks WHERE source_type = 'local'").get() as any;
    assert(localTrack, 'Local audio track should exist for streaming test');

    const streamUrl = `${baseUrl}/api/stream/${localTrack.id}`;

    // Request byte range 0-511 (512 bytes)
    const rangeRes = await fetch(streamUrl, {
      headers: {
        Range: 'bytes=0-511',
      },
    });

    assert.strictEqual(rangeRes.status, 206, `Expected status 206 Partial Content, got ${rangeRes.status}`);
    const contentRange = rangeRes.headers.get('content-range');
    assert(contentRange && contentRange.startsWith('bytes 0-511/'), `Unexpected Content-Range: ${contentRange}`);
    const contentLength = rangeRes.headers.get('content-length');
    assert.strictEqual(contentLength, '512', `Expected Content-Length 512, got ${contentLength}`);
    const bytes = await rangeRes.arrayBuffer();
    assert.strictEqual(bytes.byteLength, 512, `Expected 512 buffer bytes, got ${bytes.byteLength}`);
    console.log(`✓ Passed: HTTP 206 Partial Content streaming returned exact 512-byte chunk with Content-Range ${contentRange}`);

    // 5. Test Queue Snapshot Persistence & Restoration
    console.log('\n[Test 5] Testing Queue Snapshot CRUD Persistence...');
    const snapPayload = {
      name: 'Late Night Coding Session',
      priorityQueue: [
        { id: 'trk-sw-01', title: 'Vampires' },
        { id: 'trk-sw-02', title: 'Tech Noir' },
      ],
      contextQueue: [
        { id: 'trk-lf-01', title: 'Affection' },
      ],
      currentTrackId: 'trk-sw-01',
      currentPlaybackTime: 42.5,
      shuffleMode: 'artist-spread',
    };

    const snapPostRes = await fetch(`${baseUrl}/api/queue-snapshots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapPayload),
    });
    assert.strictEqual(snapPostRes.status, 201);
    const snapCreated = await snapPostRes.json() as any;
    assert(snapCreated.id, 'Snapshot ID must be generated');
    assert.strictEqual(snapCreated.priorityQueue.length, 2);

    const snapGetRes = await fetch(`${baseUrl}/api/queue-snapshots`);
    assert.strictEqual(snapGetRes.status, 200);
    const snapList = await snapGetRes.json() as any[];
    const found = snapList.find((s) => s.id === snapCreated.id);
    assert(found, 'Created snapshot must appear in snapshot list');
    assert.strictEqual(found.name, 'Late Night Coding Session');
    assert.strictEqual(found.currentPlaybackTime, 42.5);
    console.log('✓ Passed: Queue Snapshot saved, retrieved, and parsed with exact queue fidelity.');

    // 6. Test EQ Presets API
    console.log('\n[Test 6] Testing EQ Presets API...');
    const eqRes = await fetch(`${baseUrl}/api/eq-presets`);
    assert.strictEqual(eqRes.status, 200);
    const eqList = await eqRes.json() as any[];
    assert(eqList.length >= 6, `Expected at least 6 default EQ presets, got ${eqList.length}`);
    const bassBoost = eqList.find((p) => p.name === 'Bass Boost');
    assert(bassBoost, 'Bass Boost preset should exist');
    assert.strictEqual(bassBoost.bandGains.length, 10, 'EQ preset must have 10 band gains');
    console.log(`✓ Passed: EQ Presets API returned ${eqList.length} presets with 10 bands each.`);

    // 7. Test Synced Lyrics Proxy
    console.log('\n[Test 7] Testing Synchronized Lyrics Proxy...');
    const lyricsRes = await fetch(`${baseUrl}/api/lyrics?track_name=Vampires&artist_name=The%20Midnight`);
    assert.strictEqual(lyricsRes.status, 200);
    const lyricsData = await lyricsRes.json() as any;
    assert(lyricsData.syncedLyrics && lyricsData.syncedLyrics.includes('[00:'), 'Expected timestamped LRC lyrics');
    console.log('✓ Passed: Synced lyrics proxy returned formatted timestamped LRC lines.');

    // 8. Test Multi-Source Search (Audius + Global + Open catalog)
    console.log('\n[Test 8] Testing Multi-Source Universal Search...');
    const searchRes = await fetch(`${baseUrl}/api/spotify/search?q=ocean+eyes`);
    assert.strictEqual(searchRes.status, 200);
    const searchResults = await searchRes.json() as any[];
    assert(searchResults.length > 0, 'Expected at least 1 search result for ocean eyes');
    const audiusTrack = searchResults.find((t) => t.platform === 'audius');
    const globalTrack = searchResults.find((t) => t.platform === 'global');
    assert(audiusTrack || globalTrack, 'Expected either Audius or Global track in results');
    console.log(`✓ Passed: Multi-source search returned ${searchResults.length} tracks with direct streaming metadata.`);

    // 9. Test Stream Proxy (HTTP 206 & Full CORS)
    console.log('\n[Test 9] Testing HTTP 206 Partial Content Stream Proxy...');
    const testSampleUrl = 'https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/d6/59/2b/d6592b0b-1e7e-4743-b2e4-f2af038fd783/mzaf_7697277787797935735.plus.aac.p.m4a';
    const proxyRes = await fetch(`${baseUrl}/api/stream/proxy?url=${encodeURIComponent(testSampleUrl)}`, {
      headers: { Range: 'bytes=0-500' }
    });
    assert.strictEqual(proxyRes.status, 206, `Expected 206 Partial Content from proxy, got ${proxyRes.status}`);
    assert.strictEqual(proxyRes.headers.get('access-control-allow-origin'), '*', 'Expected Access-Control-Allow-Origin: *');
    assert.strictEqual(proxyRes.headers.get('accept-ranges'), 'bytes', 'Expected Accept-Ranges: bytes');
    console.log('✓ Passed: Stream proxy delivered 206 chunk with full CORS and Range headers.');

    // 10. Test Spotify Song Radio & Audio Features
    console.log('\n[Test 10] Testing Spotify Song Radio & Acoustic Audio Features...');
    const anyTrack = db.prepare('SELECT id, title FROM tracks LIMIT 1').get() as any;
    assert(anyTrack, 'Track must exist');

    const radioRes = await fetch(`${baseUrl}/api/tracks/${anyTrack.id}/radio?limit=15`);
    assert.strictEqual(radioRes.status, 200);
    const radioData = await radioRes.json() as any;
    assert(radioData.radioPlaylistName.includes('Radio'), 'Radio playlist name must include Radio');
    assert(Array.isArray(radioData.tracks) && radioData.tracks.length > 0, 'Radio must return track recommendations');

    const featuresRes = await fetch(`${baseUrl}/api/tracks/${anyTrack.id}/audio-features`);
    assert.strictEqual(featuresRes.status, 200);
    const features = await featuresRes.json() as any;
    assert(typeof features.danceability === 'number', 'Danceability must be number');
    assert(typeof features.energy === 'number', 'Energy must be number');
    assert(typeof features.valence === 'number', 'Valence must be number');
    assert(typeof features.tempo === 'number', 'Tempo must be number');
    console.log(`✓ Passed: Song Radio generated "${radioData.radioPlaylistName}" with ${radioData.tracks.length} tracks; Audio Features returned tempo=${features.tempo} BPM, valence=${features.valence}`);

    // 11. Test Spotify Daily Mixes Generator
    console.log('\n[Test 11] Testing Spotify Daily Mixes Generator...');
    const mixesRes = await fetch(`${baseUrl}/api/mixes`);
    assert.strictEqual(mixesRes.status, 200);
    const mixesData = await mixesRes.json() as any;
    assert(Array.isArray(mixesData.mixes) && mixesData.mixes.length > 0, 'Expected generated Daily Mixes');
    assert(mixesData.mixes[0].name.startsWith('Daily Mix'), 'First mix must be named Daily Mix 1');
    assert(mixesData.mixes[0].tracks.length > 0, 'Daily Mix must contain tracks');
    console.log(`✓ Passed: Daily Mixes generator created ${mixesData.mixes.length} personalized genre clusters.`);

    // 12. Test User Stats & Instant Search Suggestions
    console.log('\n[Test 12] Testing Listening Stats, Recently Played, and Search Suggestions...');
    const statsRes = await fetch(`${baseUrl}/api/me/stats`);
    assert.strictEqual(statsRes.status, 200);
    const stats = await statsRes.json() as any;
    assert(typeof stats.totalTracks === 'number' && stats.totalTracks > 0);

    const suggestRes = await fetch(`${baseUrl}/api/search/suggestions?q=a`);
    assert.strictEqual(suggestRes.status, 200);
    const suggestions = await suggestRes.json() as any;
    assert(Array.isArray(suggestions.songs));
    assert(Array.isArray(suggestions.artists));
    console.log(`✓ Passed: Stats returned totalTracks=${stats.totalTracks}, search suggestions delivered categorized hits.`);

    console.log('\n=========================================');
    console.log('ALL BACKEND INTEGRATION TESTS PASSED (0 failures)');
    console.log('=========================================\n');
  } finally {
    server.close();
  }
}

runAllTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
