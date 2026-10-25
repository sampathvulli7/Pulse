import { db } from './database';
import fs from 'fs';
import path from 'path';

export function generateSampleWav(filepath: string, durationSec: number = 5, freqHz: number = 440) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSec);
  const blockAlign = 2; // 16-bit mono
  const byteRate = sampleRate * blockAlign;
  const subChunk2Size = numSamples * blockAlign;
  const chunkSize = 36 + subChunk2Size;

  const buffer = Buffer.alloc(44 + subChunk2Size);

  // RIFF identifier
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);

  // 'fmt ' chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // 'data' chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(subChunk2Size, 40);

  // Write sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Slight vibrato + soft envelope
    const envelope = Math.min(1, Math.min(t * 4, (durationSec - t) * 4));
    const sample = Math.sin(2 * Math.PI * freqHz * t) * 0.7 * envelope;
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  const dir = path.dirname(filepath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filepath, buffer);
}

export function seedDemoData() {
  // Ensure local sample files exist
  const localDir = path.resolve(__dirname, '../../audio_library');
  const sampleFiles = [
    { file: 'sunset_drive.wav', duration: 12, freq: 220, title: 'Sunset Drive (Local HQ Master)', artist: 'The Midnight Synth', bpm: 118, energy: 0.82, genre: 'Synthwave' },
    { file: 'rainy_coffee.wav', duration: 15, freq: 330, title: 'Rainy Coffee Shop (Local FLAC/WAV)', artist: 'Lofi Dreamer', bpm: 78, energy: 0.35, genre: 'Lo-Fi' },
    { file: 'quantum_leap.wav', duration: 10, freq: 440, title: 'Quantum Leap (Local Stem)', artist: 'Cyberpulse', bpm: 128, energy: 0.91, genre: 'Electronic' },
  ];

  for (const s of sampleFiles) {
    const p = path.join(localDir, s.file);
    if (!fs.existsSync(p)) {
      generateSampleWav(p, s.duration, s.freq);
    }
  }

  const tracksCount = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number };
  if (tracksCount.count >= 50) {
    return { seeded: 0, total: tracksCount.count };
  }

  const tracksStmt = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, title, artist, album, duration_seconds, source_type, source_url, local_path,
      youtube_video_id, cover_art_url, bpm, energy, key_signature, genre, isrc, bitrate
    ) VALUES (
      @id, @title, @artist, @album, @duration_seconds, @source_type, @source_url, @local_path,
      @youtube_video_id, @cover_art_url, @bpm, @energy, @key_signature, @genre, @isrc, @bitrate
    )
  `);

  const rawTracks = [
    // 1-3: Local Audio with real full-length audio files (3-5 minutes each!)
    {
      id: 'trk-local-01',
      title: 'Sunset Drive (Local HQ Master)',
      artist: 'The Midnight Synth',
      album: 'Endless Summer Days',
      duration_seconds: 326,
      source_type: 'local',
      source_url: '/api/stream/trk-local-01',
      local_path: fs.existsSync(path.join(localDir, 'sunset_drive.mp3'))
        ? path.join(localDir, 'sunset_drive.mp3')
        : path.join(localDir, 'sunset_drive.wav'),
      youtube_video_id: 'URma_gu1aNE',
      cover_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      bpm: 118,
      energy: 0.82,
      key_signature: 'A minor',
      genre: 'Synthwave',
      isrc: 'USM112400001',
      bitrate: 320
    },
    {
      id: 'trk-local-02',
      title: 'Rainy Coffee Shop (Local FLAC/WAV)',
      artist: 'Lofi Dreamer',
      album: 'Sunday Morning Coffee',
      duration_seconds: 158,
      source_type: 'local',
      source_url: '/api/stream/trk-local-02',
      local_path: fs.existsSync(path.join(localDir, 'rainy_coffee.mp3'))
        ? path.join(localDir, 'rainy_coffee.mp3')
        : path.join(localDir, 'rainy_coffee.wav'),
      youtube_video_id: 'cvIROwGAOn8',
      cover_art_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
      bpm: 78,
      energy: 0.35,
      key_signature: 'C major',
      genre: 'Lo-Fi',
      isrc: 'USL240000002',
      bitrate: 320
    },
    {
      id: 'trk-local-03',
      title: 'Quantum Leap (Local Stem)',
      artist: 'Cyberpulse',
      album: 'Neon Horizon',
      duration_seconds: 270,
      source_type: 'local',
      source_url: '/api/stream/trk-local-03',
      local_path: fs.existsSync(path.join(localDir, 'quantum_leap.mp3'))
        ? path.join(localDir, 'quantum_leap.mp3')
        : path.join(localDir, 'quantum_leap.wav'),
      youtube_video_id: 'TvZskcqdYcE',
      cover_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      bpm: 128,
      energy: 0.91,
      key_signature: 'F# minor',
      genre: 'Electronic',
      isrc: 'USE240000003',
      bitrate: 320
    },

    // 4-15: Synthwave & Retrowave
    {
      id: 'trk-sw-01',
      title: 'Vampires',
      artist: 'The Midnight',
      album: 'Endless Summer',
      duration_seconds: 317,
      source_type: 'youtube',
      youtube_video_id: 'm38T5vOhy_M',
      cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      bpm: 110,
      energy: 0.78,
      key_signature: 'D minor',
      genre: 'Synthwave',
      isrc: 'USMID1600001',
      bitrate: 320
    },
    {
      id: 'trk-sw-02',
      title: 'Tech Noir',
      artist: 'GUNSHIP',
      album: 'GUNSHIP',
      duration_seconds: 298,
      source_type: 'youtube',
      youtube_video_id: '-ED-B5Hq-sU',
      cover_art_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
      bpm: 105,
      energy: 0.74,
      key_signature: 'A minor',
      genre: 'Synthwave',
      isrc: 'UKGUN1500002',
      bitrate: 320
    },
    {
      id: 'trk-sw-03',
      title: 'Running in the Night',
      artist: 'FM-84 ft. Ollie Wride',
      album: 'Atlas',
      duration_seconds: 270,
      source_type: 'youtube',
      youtube_video_id: 'lTfQW_nA1s8',
      cover_art_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
      bpm: 112,
      energy: 0.81,
      key_signature: 'G major',
      genre: 'Synthwave',
      isrc: 'USFM81600003',
      bitrate: 320
    },
    {
      id: 'trk-sw-04',
      title: 'Nightcall',
      artist: 'Kavinsky',
      album: 'OutRun',
      duration_seconds: 259,
      source_type: 'youtube',
      youtube_video_id: 'MV_3Dpw-BRY',
      cover_art_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      bpm: 91,
      energy: 0.65,
      key_signature: 'A minor',
      genre: 'Synthwave',
      isrc: 'FRKAV1000004',
      bitrate: 320
    },
    {
      id: 'trk-sw-05',
      title: 'Turbo Killer',
      artist: 'Carpenter Brut',
      album: 'Trilogy',
      duration_seconds: 208,
      source_type: 'youtube',
      youtube_video_id: 'er416j8OF0s',
      cover_art_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
      bpm: 140,
      energy: 0.95,
      key_signature: 'E minor',
      genre: 'Synthwave',
      isrc: 'FRCAR1500005',
      bitrate: 320
    },
    {
      id: 'trk-sw-06',
      title: 'Sunset',
      artist: 'The Midnight',
      album: 'Endless Summer',
      duration_seconds: 326,
      source_type: 'youtube',
      youtube_video_id: 'rDBbaGCCIhk',
      cover_art_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
      bpm: 116,
      energy: 0.84,
      key_signature: 'C major',
      genre: 'Synthwave',
      isrc: 'USMID1600006',
      bitrate: 320
    },
    {
      id: 'trk-sw-07',
      title: 'Fly For Your Life',
      artist: 'GUNSHIP',
      album: 'GUNSHIP',
      duration_seconds: 279,
      source_type: 'youtube',
      youtube_video_id: 'Jv1ZN8c4_Gs',
      cover_art_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
      bpm: 120,
      energy: 0.88,
      key_signature: 'B minor',
      genre: 'Synthwave',
      isrc: 'UKGUN1500007',
      bitrate: 320
    },
    {
      id: 'trk-sw-08',
      title: 'Days of Thunder',
      artist: 'The Midnight',
      album: 'Days of Thunder',
      duration_seconds: 329,
      source_type: 'youtube',
      youtube_video_id: '4F4HkKz5w88',
      cover_art_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      bpm: 114,
      energy: 0.79,
      key_signature: 'G minor',
      genre: 'Synthwave',
      isrc: 'USMID1400008',
      bitrate: 320
    },

    // 16-25: Rock & Alternative
    {
      id: 'trk-rk-01',
      title: 'Everlong',
      artist: 'Foo Fighters',
      album: 'The Colour and the Shape',
      duration_seconds: 250,
      source_type: 'youtube',
      youtube_video_id: 'eBG7P-K-r1Y',
      cover_art_url: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&q=80',
      bpm: 158,
      energy: 0.92,
      key_signature: 'D major',
      genre: 'Rock',
      isrc: 'USRC19700009',
      bitrate: 320
    },
    {
      id: 'trk-rk-02',
      title: 'Do I Wanna Know?',
      artist: 'Arctic Monkeys',
      album: 'AM',
      duration_seconds: 272,
      source_type: 'youtube',
      youtube_video_id: 'bpOSxM0rNPM',
      cover_art_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&q=80',
      bpm: 85,
      energy: 0.70,
      key_signature: 'G minor',
      genre: 'Rock',
      isrc: 'GBBKS1300010',
      bitrate: 320
    },
    {
      id: 'trk-rk-03',
      title: 'Knights of Cydonia',
      artist: 'Muse',
      album: 'Black Holes and Revelations',
      duration_seconds: 366,
      source_type: 'youtube',
      youtube_video_id: 'G_sBOsh-vyI',
      cover_art_url: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=400&q=80',
      bpm: 137,
      energy: 0.96,
      key_signature: 'E minor',
      genre: 'Rock',
      isrc: 'GBAHT0600011',
      bitrate: 320
    },
    {
      id: 'trk-rk-04',
      title: 'Figure It Out',
      artist: 'Royal Blood',
      album: 'Royal Blood',
      duration_seconds: 184,
      source_type: 'youtube',
      youtube_video_id: 'jhgVu2hGHFU',
      cover_art_url: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?w=400&q=80',
      bpm: 108,
      energy: 0.89,
      key_signature: 'D minor',
      genre: 'Rock',
      isrc: 'GBAHS1400012',
      bitrate: 320
    },
    {
      id: 'trk-rk-05',
      title: 'The Pretender',
      artist: 'Foo Fighters',
      album: 'Echoes, Silence, Patience & Grace',
      duration_seconds: 269,
      source_type: 'youtube',
      youtube_video_id: 'SBjQ9tuuTJQ',
      cover_art_url: 'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=400&q=80',
      bpm: 173,
      energy: 0.95,
      key_signature: 'A minor',
      genre: 'Rock',
      isrc: 'USRC10700013',
      bitrate: 320
    },
    {
      id: 'trk-rk-06',
      title: 'R U Mine?',
      artist: 'Arctic Monkeys',
      album: 'AM',
      duration_seconds: 201,
      source_type: 'youtube',
      youtube_video_id: 'VQH8ZTgna3Q',
      cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      bpm: 97,
      energy: 0.86,
      key_signature: 'F# minor',
      genre: 'Rock',
      isrc: 'GBBKS1200014',
      bitrate: 320
    },
    {
      id: 'trk-rk-07',
      title: 'Hysteria',
      artist: 'Muse',
      album: 'Absolution',
      duration_seconds: 227,
      source_type: 'youtube',
      youtube_video_id: '3dm_5qWWDV8',
      cover_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      bpm: 118,
      energy: 0.94,
      key_signature: 'A minor',
      genre: 'Rock',
      isrc: 'GBAHT0300015',
      bitrate: 320
    },
    {
      id: 'trk-rk-08',
      title: 'Out of the Black',
      artist: 'Royal Blood',
      album: 'Royal Blood',
      duration_seconds: 240,
      source_type: 'youtube',
      youtube_video_id: 'bSdtvfBQd6c',
      cover_art_url: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&q=80',
      bpm: 122,
      energy: 0.91,
      key_signature: 'E minor',
      genre: 'Rock',
      isrc: 'GBAHS1300016',
      bitrate: 320
    },

    // 26-33: Lo-Fi, Chillhop & Ambient
    {
      id: 'trk-lf-01',
      title: 'Affection',
      artist: 'Jinsang',
      album: 'Solitude',
      duration_seconds: 140,
      source_type: 'youtube',
      youtube_video_id: 'g4N3S4Z8y4g',
      cover_art_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
      bpm: 82,
      energy: 0.32,
      key_signature: 'Eb major',
      genre: 'Lo-Fi',
      isrc: 'USJIN1600017',
      bitrate: 320
    },
    {
      id: 'trk-lf-02',
      title: 'Again',
      artist: 'Wun Two',
      album: 'Penthouse',
      duration_seconds: 124,
      source_type: 'youtube',
      youtube_video_id: 'aT6qYF1-W6U',
      cover_art_url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&q=80',
      bpm: 76,
      energy: 0.28,
      key_signature: 'C minor',
      genre: 'Lo-Fi',
      isrc: 'DEWUN1500018',
      bitrate: 320
    },
    {
      id: 'trk-lf-03',
      title: 'Both of Us',
      artist: 'idealism',
      album: 'Rainy Evening',
      duration_seconds: 165,
      source_type: 'youtube',
      youtube_video_id: '9YfXhy-u0zQ',
      cover_art_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
      bpm: 74,
      energy: 0.25,
      key_signature: 'F major',
      genre: 'Lo-Fi',
      isrc: 'FIIDE1700019',
      bitrate: 320
    },
    {
      id: 'trk-lf-04',
      title: 'Roots',
      artist: 'Kupla',
      album: 'Kingdom in Blue',
      duration_seconds: 158,
      source_type: 'youtube',
      youtube_video_id: 'Zk6L_vX7F90',
      cover_art_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80',
      bpm: 80,
      energy: 0.34,
      key_signature: 'G major',
      genre: 'Lo-Fi',
      isrc: 'FIKUP1900020',
      bitrate: 320
    },
    {
      id: 'trk-lf-05',
      title: 'Controlla',
      artist: 'idealism',
      album: 'Amaranth',
      duration_seconds: 172,
      source_type: 'youtube',
      youtube_video_id: 'lJzL9F1v3kA',
      cover_art_url: 'https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=400&q=80',
      bpm: 84,
      energy: 0.30,
      key_signature: 'Ab major',
      genre: 'Lo-Fi',
      isrc: 'FIIDE1800021',
      bitrate: 320
    },
    {
      id: 'trk-lf-06',
      title: 'Sleepy Fish',
      artist: 'Sleepy Fish',
      album: 'My Room Becomes the Sea',
      duration_seconds: 195,
      source_type: 'youtube',
      youtube_video_id: '2B1G3S4F_8c',
      cover_art_url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
      bpm: 70,
      energy: 0.22,
      key_signature: 'D major',
      genre: 'Lo-Fi',
      isrc: 'USSLE1900022',
      bitrate: 320
    },

    // 34-42: Electronic, Dance & House
    {
      id: 'trk-ed-01',
      title: 'Harder, Better, Faster, Stronger',
      artist: 'Daft Punk',
      album: 'Discovery',
      duration_seconds: 224,
      source_type: 'youtube',
      youtube_video_id: 'yydNF8tuVmU',
      cover_art_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      bpm: 123,
      energy: 0.88,
      key_signature: 'F# minor',
      genre: 'Electronic',
      isrc: 'FRDAF0100023',
      bitrate: 320
    },
    {
      id: 'trk-ed-02',
      title: 'Strobe',
      artist: 'deadmau5',
      album: 'For Lack of a Better Name',
      duration_seconds: 637,
      source_type: 'youtube',
      youtube_video_id: 'tKi9Z-f6qX4',
      cover_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      bpm: 128,
      energy: 0.85,
      key_signature: 'Bb minor',
      genre: 'Electronic',
      isrc: 'USMAU0900024',
      bitrate: 320
    },
    {
      id: 'trk-ed-03',
      title: 'Shelter',
      artist: 'Porter Robinson & Madeon',
      album: 'Shelter',
      duration_seconds: 219,
      source_type: 'youtube',
      youtube_video_id: 'fzQ6gRAEoy0',
      cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      bpm: 100,
      energy: 0.89,
      key_signature: 'C major',
      genre: 'Electronic',
      isrc: 'USPR16000025',
      bitrate: 320
    },
    {
      id: 'trk-ed-04',
      title: 'Genesis',
      artist: 'Justice',
      album: 'Cross',
      duration_seconds: 234,
      source_type: 'youtube',
      youtube_video_id: 'ThKNt-GY1ww',
      cover_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      bpm: 117,
      energy: 0.93,
      key_signature: 'D minor',
      genre: 'Electronic',
      isrc: 'FRJUS0700026',
      bitrate: 320
    },
    {
      id: 'trk-ed-05',
      title: 'One More Time',
      artist: 'Daft Punk',
      album: 'Discovery',
      duration_seconds: 320,
      source_type: 'youtube',
      youtube_video_id: 'FGBhQbmMxw8',
      cover_art_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
      bpm: 123,
      energy: 0.90,
      key_signature: 'D major',
      genre: 'Electronic',
      isrc: 'FRDAF0000027',
      bitrate: 320
    },
    {
      id: 'trk-ed-06',
      title: 'Divinity',
      artist: 'Porter Robinson',
      album: 'Worlds',
      duration_seconds: 385,
      source_type: 'youtube',
      youtube_video_id: 'si814o9g3Sk',
      cover_art_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
      bpm: 90,
      energy: 0.82,
      key_signature: 'B major',
      genre: 'Electronic',
      isrc: 'USPR14000028',
      bitrate: 320
    },

    // 43-48: Metal & Progressive
    {
      id: 'trk-mt-01',
      title: 'Schism',
      artist: 'Tool',
      album: 'Lateralus',
      duration_seconds: 406,
      source_type: 'youtube',
      youtube_video_id: 'MM62Aval88A',
      cover_art_url: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?w=400&q=80',
      bpm: 105,
      energy: 0.87,
      key_signature: 'D minor',
      genre: 'Metal',
      isrc: 'USTOO0100029',
      bitrate: 320
    },
    {
      id: 'trk-mt-02',
      title: 'Flying Whales',
      artist: 'Gojira',
      album: 'From Mars to Sirius',
      duration_seconds: 464,
      source_type: 'youtube',
      youtube_video_id: 'sC_GqW4c6_M',
      cover_art_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
      bpm: 110,
      energy: 0.94,
      key_signature: 'D minor',
      genre: 'Metal',
      isrc: 'FRGOJ0500030',
      bitrate: 320
    },
    {
      id: 'trk-mt-03',
      title: 'Bleed',
      artist: 'Meshuggah',
      album: 'obZen',
      duration_seconds: 442,
      source_type: 'youtube',
      youtube_video_id: 'qc98deJK9AU',
      cover_art_url: 'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=400&q=80',
      bpm: 115,
      energy: 0.98,
      key_signature: 'F minor',
      genre: 'Metal',
      isrc: 'SEMES0800031',
      bitrate: 320
    },

    // 49-54: Classical, Cinematic & Ambient
    {
      id: 'trk-cl-01',
      title: 'Time',
      artist: 'Hans Zimmer',
      album: 'Inception (OST)',
      duration_seconds: 275,
      source_type: 'youtube',
      youtube_video_id: 'RxabLA7UQ9k',
      cover_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      bpm: 60,
      energy: 0.60,
      key_signature: 'A minor',
      genre: 'Classical',
      isrc: 'USZIM1000032',
      bitrate: 320
    },
    {
      id: 'trk-cl-02',
      title: 'Nuvole Bianche',
      artist: 'Ludovico Einaudi',
      album: 'Una Mattina',
      duration_seconds: 357,
      source_type: 'youtube',
      youtube_video_id: '4VR-6AS0-l4',
      cover_art_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      bpm: 64,
      energy: 0.35,
      key_signature: 'Ab minor',
      genre: 'Classical',
      isrc: 'ITEIN0400033',
      bitrate: 320
    },
    {
      id: 'trk-cl-03',
      title: 'On the Nature of Daylight',
      artist: 'Max Richter',
      album: 'The Blue Notebooks',
      duration_seconds: 371,
      source_type: 'youtube',
      youtube_video_id: 'rVN1B-tUYA8',
      cover_art_url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80',
      bpm: 54,
      energy: 0.40,
      key_signature: 'Bb minor',
      genre: 'Classical',
      isrc: 'GBRIC0400034',
      bitrate: 320
    },

    // 55-60: Pop, R&B & Jazz
    {
      id: 'trk-pp-01',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      album: 'After Hours',
      duration_seconds: 200,
      source_type: 'youtube',
      youtube_video_id: '4NRXx6U8ABQ',
      cover_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      bpm: 171,
      energy: 0.80,
      key_signature: 'F minor',
      genre: 'Pop',
      isrc: 'USUG11904206',
      bitrate: 320
    },
    {
      id: 'trk-pp-02',
      title: 'Levitating',
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      duration_seconds: 203,
      source_type: 'youtube',
      youtube_video_id: 'TUVcZfQe-Kw',
      cover_art_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
      bpm: 103,
      energy: 0.83,
      key_signature: 'B minor',
      genre: 'Pop',
      isrc: 'GBAHT2000244',
      bitrate: 320
    },
    {
      id: 'trk-jz-01',
      title: 'Lingus',
      artist: 'Snarky Puppy',
      album: 'We Like It Here',
      duration_seconds: 645,
      source_type: 'youtube',
      youtube_video_id: 'L_XJ_s5IsQc',
      cover_art_url: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=400&q=80',
      bpm: 125,
      energy: 0.88,
      key_signature: 'E minor',
      genre: 'Jazz',
      isrc: 'USPUP1400035',
      bitrate: 320
    },
    {
      id: 'trk-jz-02',
      title: 'So What',
      artist: 'Miles Davis',
      album: 'Kind of Blue',
      duration_seconds: 562,
      source_type: 'youtube',
      youtube_video_id: 'zqNTltOGh5c',
      cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      bpm: 136,
      energy: 0.55,
      key_signature: 'D dorian',
      genre: 'Jazz',
      isrc: 'USCOL5900036',
      bitrate: 320
    },

    // 42-56: Extended Library Tracks across Genres
    {
      id: 'trk-sw-09',
      title: 'Gloria',
      artist: 'The Midnight',
      album: 'Endless Summer',
      duration_seconds: 334,
      source_type: 'youtube',
      youtube_video_id: 'lJ32bXvN-0E',
      cover_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      bpm: 112,
      energy: 0.83,
      key_signature: 'A major',
      genre: 'Synthwave',
      isrc: 'USMID1600037',
      bitrate: 320
    },
    {
      id: 'trk-sw-10',
      title: 'Dark All Day',
      artist: 'GUNSHIP ft. Tim Cappello',
      album: 'Dark All Day',
      duration_seconds: 328,
      source_type: 'youtube',
      youtube_video_id: 'v_XjK5oZkZg',
      cover_art_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=400&q=80',
      bpm: 104,
      energy: 0.85,
      key_signature: 'D minor',
      genre: 'Synthwave',
      isrc: 'UKGUN1800038',
      bitrate: 320
    },
    {
      id: 'trk-ed-07',
      title: 'Around the World',
      artist: 'Daft Punk',
      album: 'Homework',
      duration_seconds: 429,
      source_type: 'youtube',
      youtube_video_id: 'dwDns8x3Jb4',
      cover_art_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80',
      bpm: 121,
      energy: 0.82,
      key_signature: 'E minor',
      genre: 'Electronic',
      isrc: 'FRDAF9700039',
      bitrate: 320
    },
    {
      id: 'trk-ed-08',
      title: 'Ghosts \'n\' Stuff',
      artist: 'deadmau5 ft. Rob Swire',
      album: 'For Lack of a Better Name',
      duration_seconds: 191,
      source_type: 'youtube',
      youtube_video_id: 'h7ArUgxtlJs',
      cover_art_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      bpm: 128,
      energy: 0.94,
      key_signature: 'B minor',
      genre: 'Electronic',
      isrc: 'USMAU0900040',
      bitrate: 320
    },
    {
      id: 'trk-ed-09',
      title: 'Sad Machine',
      artist: 'Porter Robinson',
      album: 'Worlds',
      duration_seconds: 350,
      source_type: 'youtube',
      youtube_video_id: 'HAIDqt2aUek',
      cover_art_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
      bpm: 90,
      energy: 0.77,
      key_signature: 'Bb major',
      genre: 'Electronic',
      isrc: 'USPR14000041',
      bitrate: 320
    },
    {
      id: 'trk-mt-04',
      title: 'Silvera',
      artist: 'Gojira',
      album: 'Magma',
      duration_seconds: 213,
      source_type: 'youtube',
      youtube_video_id: 'iVvXB-Vwnco',
      cover_art_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80',
      bpm: 130,
      energy: 0.96,
      key_signature: 'D minor',
      genre: 'Metal',
      isrc: 'FRGOJ1600042',
      bitrate: 320
    },
    {
      id: 'trk-mt-05',
      title: 'Lateralus',
      artist: 'Tool',
      album: 'Lateralus',
      duration_seconds: 564,
      source_type: 'youtube',
      youtube_video_id: 'Y7JG63Iua4M',
      cover_art_url: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?w=400&q=80',
      bpm: 98,
      energy: 0.89,
      key_signature: 'D minor',
      genre: 'Metal',
      isrc: 'USTOO0100043',
      bitrate: 320
    },
    {
      id: 'trk-lf-07',
      title: 'Snowman',
      artist: 'Wun Two',
      album: 'Seasons',
      duration_seconds: 132,
      source_type: 'youtube',
      youtube_video_id: 'F5R00b0UuLw',
      cover_art_url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400&q=80',
      bpm: 75,
      energy: 0.24,
      key_signature: 'Ab major',
      genre: 'Lo-Fi',
      isrc: 'DEWUN1600044',
      bitrate: 320
    },
    {
      id: 'trk-lf-08',
      title: 'Lonely Day',
      artist: 'idealism',
      album: 'Hiraeth',
      duration_seconds: 148,
      source_type: 'youtube',
      youtube_video_id: 'Y3kK5B7l9kI',
      cover_art_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
      bpm: 72,
      energy: 0.21,
      key_signature: 'F minor',
      genre: 'Lo-Fi',
      isrc: 'FIIDE1900045',
      bitrate: 320
    },
    {
      id: 'trk-cl-04',
      title: 'Experience',
      artist: 'Ludovico Einaudi',
      album: 'In a Time Lapse',
      duration_seconds: 315,
      source_type: 'youtube',
      youtube_video_id: 'hN_q-_nGv4U',
      cover_art_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
      bpm: 88,
      energy: 0.62,
      key_signature: 'F# minor',
      genre: 'Classical',
      isrc: 'ITEIN1300046',
      bitrate: 320
    },
    {
      id: 'trk-cl-05',
      title: 'Cornfield Chase',
      artist: 'Hans Zimmer',
      album: 'Interstellar (OST)',
      duration_seconds: 126,
      source_type: 'youtube',
      youtube_video_id: '1V_xRb0x9aw',
      cover_art_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
      bpm: 96,
      energy: 0.73,
      key_signature: 'A minor',
      genre: 'Classical',
      isrc: 'USZIM1400047',
      bitrate: 320
    },
    {
      id: 'trk-rk-09',
      title: 'Supermassive Black Hole',
      artist: 'Muse',
      album: 'Black Holes and Revelations',
      duration_seconds: 209,
      source_type: 'youtube',
      youtube_video_id: 'Xsp3_a-PMTw',
      cover_art_url: 'https://images.unsplash.com/photo-1511735111819-9a3f7709049c?w=400&q=80',
      bpm: 120,
      energy: 0.93,
      key_signature: 'E minor',
      genre: 'Rock',
      isrc: 'GBAHT0600048',
      bitrate: 320
    },
    {
      id: 'trk-rk-10',
      title: 'Best of You',
      artist: 'Foo Fighters',
      album: 'In Your Honor',
      duration_seconds: 256,
      source_type: 'youtube',
      youtube_video_id: 'h_L44BwvlFA',
      cover_art_url: 'https://images.unsplash.com/photo-1471478331149-c72f17e33c73?w=400&q=80',
      bpm: 130,
      energy: 0.95,
      key_signature: 'C# minor',
      genre: 'Rock',
      isrc: 'USRC10500049',
      bitrate: 320
    },
    {
      id: 'trk-pp-03',
      title: 'Save Your Tears',
      artist: 'The Weeknd',
      album: 'After Hours',
      duration_seconds: 215,
      source_type: 'youtube',
      youtube_video_id: 'XXYlFuWEuKi',
      cover_art_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
      bpm: 118,
      energy: 0.82,
      key_signature: 'C major',
      genre: 'Pop',
      isrc: 'USUG12000050',
      bitrate: 320
    },
    {
      id: 'trk-pp-04',
      title: 'Don\'t Start Now',
      artist: 'Dua Lipa',
      album: 'Future Nostalgia',
      duration_seconds: 183,
      source_type: 'youtube',
      youtube_video_id: 'oygrmJFKYZY',
      cover_art_url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&q=80',
      bpm: 124,
      energy: 0.85,
      key_signature: 'B minor',
      genre: 'Pop',
      isrc: 'GBAHT1900051',
      bitrate: 320
    },
    {
      id: 'trk-jz-03',
      title: 'What a Wonderful World',
      artist: 'Louis Armstrong',
      album: 'What a Wonderful World',
      duration_seconds: 139,
      source_type: 'youtube',
      youtube_video_id: 'VqhCQZaH4Vs',
      cover_art_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
      bpm: 72,
      energy: 0.38,
      key_signature: 'F major',
      genre: 'Jazz',
      isrc: 'USMC16700052',
      bitrate: 320
    }
  ];

  let insertedCount = 0;
  for (const track of rawTracks) {
    tracksStmt.run({
      id: track.id,
      title: track.title,
      artist: track.artist,
      album: track.album || null,
      duration_seconds: track.duration_seconds,
      source_type: track.source_type,
      source_url: track.source_url || null,
      local_path: track.local_path || null,
      youtube_video_id: track.youtube_video_id || null,
      cover_art_url: track.cover_art_url || null,
      bpm: track.bpm || null,
      energy: track.energy || null,
      key_signature: track.key_signature || null,
      genre: track.genre || null,
      isrc: track.isrc || null,
      bitrate: track.bitrate || 320
    });
    insertedCount++;
  }

  // Create default playlists
  const playlistStmt = db.prepare(`
    INSERT OR REPLACE INTO playlists (id, name, description, is_smart, cover_url, is_favorite)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  playlistStmt.run(
    'pl-synthwave',
    'Synthwave Highway',
    'Retro neon drives, analog synthesizers, and midnight cruising.',
    0,
    'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80',
    1
  );

  playlistStmt.run(
    'pl-rock-anthems',
    'Alternative & Modern Rock',
    'Distorted basslines, thunderous drums, and stadium riffs.',
    0,
    'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&q=80',
    1
  );

  playlistStmt.run(
    'pl-lofi-beats',
    'Lo-Fi Study Sanctuary',
    'Warm vinyl crackle, mellow piano chords, and relaxed focus.',
    0,
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400&q=80',
    0
  );

  // Smart Playlists
  playlistStmt.run(
    'pl-smart-high-energy',
    '⚡ High Energy Workout (Smart)',
    'Dynamic smart playlist: Energy >= 0.85 and BPM >= 115',
    1,
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
    1
  );

  playlistStmt.run(
    'pl-smart-chill',
    '🌙 Late Night Chill (Smart)',
    'Dynamic smart playlist: Energy <= 0.40 or Genre equals Lo-Fi',
    1,
    'https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=400&q=80',
    0
  );

  // Link tracks into regular playlists
  const linkStmt = db.prepare(`
    INSERT OR REPLACE INTO playlist_tracks (id, playlist_id, track_id, position)
    VALUES (?, ?, ?, ?)
  `);

  const synthwaveTracks = rawTracks.filter(t => t.genre === 'Synthwave' || t.id === 'trk-local-01');
  synthwaveTracks.forEach((t, i) => {
    linkStmt.run(`pltr-sw-${i}`, 'pl-synthwave', t.id, i);
  });

  const rockTracks = rawTracks.filter(t => t.genre === 'Rock');
  rockTracks.forEach((t, i) => {
    linkStmt.run(`pltr-rk-${i}`, 'pl-rock-anthems', t.id, i);
  });

  const lofiTracks = rawTracks.filter(t => t.genre === 'Lo-Fi' || t.id === 'trk-local-02');
  lofiTracks.forEach((t, i) => {
    linkStmt.run(`pltr-lf-${i}`, 'pl-lofi-beats', t.id, i);
  });

  // Insert Smart Playlist Rules
  const ruleStmt = db.prepare(`
    INSERT OR REPLACE INTO smart_playlist_rules (id, playlist_id, field, operator, value, logic_gate)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Rule 1 & 2 for High Energy
  ruleStmt.run('rule-he-1', 'pl-smart-high-energy', 'energy', 'greater_than', '0.84', 'AND');
  ruleStmt.run('rule-he-2', 'pl-smart-high-energy', 'bpm', 'greater_than', '114', 'AND');

  // Rule 1 for Chill
  ruleStmt.run('rule-ch-1', 'pl-smart-chill', 'energy', 'less_than', '0.45', 'AND');

  return { seeded: insertedCount, total: rawTracks.length, playlistCount: 5 };
}
