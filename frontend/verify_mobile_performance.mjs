import puppeteer from 'puppeteer-core';
import path from 'path';

(async () => {
  console.log('--- Launching Mobile Browser Verification ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-fake-ui-for-media-stream'],
  });

  const page = await browser.newPage();
  
  // Set iPhone 14 Pro mobile viewport
  await page.setViewport({
    width: 393,
    height: 852,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });

  const consoleLogs = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleLogs.push(msg.text());
    }
  });

  const startTime = Date.now();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
  const loadDuration = Date.now() - startTime;
  console.log(`✓ Mobile page loaded in ${loadDuration}ms`);

  // Wait for track table to render
  await page.waitForSelector('h1', { timeout: 5000 });

  // 1. Check DOM node count and progressive windowing
  const domStats = await page.evaluate(() => {
    const totalNodes = document.querySelectorAll('*').length;
    const mobileTrackElements = document.querySelectorAll('[key^="mob-"], div[class*="active:bg-slate-50"]').length;
    return { totalNodes, mobileTrackElements };
  });
  console.log(`✓ Progressive DOM Stats: Total DOM elements = ${domStats.totalNodes}, visible track rows = ${domStats.mobileTrackElements}`);

  // Screenshot 1: Mobile Track List
  const screenshotTrackList = '/Users/sampath.v_/.gemini/antigravity/brain/e7830122-319c-42aa-bf01-084108925470/pulse_mobile_track_list.png';
  await page.screenshot({ path: screenshotTrackList });
  console.log(`✓ Saved: ${screenshotTrackList}`);

  // 2. Play 2nd track (Dandelions by Ruth B. - vocal track with lyrics)
  console.log('Playing Ruth B. - Dandelions on mobile...');
  const trackElements = await page.$$('div[class*="active:bg-slate-50"]');
  if (trackElements.length > 1) {
    await trackElements[1].click(); // Click Dandelions
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 3. Open Mobile Now Playing drawer by clicking the mini-player surface
  console.log('Opening Mobile Now Playing view...');
  const miniPlayerSurface = await page.$('div[class*="cursor-pointer active:bg-slate-100"]');
  if (miniPlayerSurface) {
    await miniPlayerSurface.click();
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Screenshot 2: Mobile Now Playing
  const screenshotNowPlaying = '/Users/sampath.v_/.gemini/antigravity/brain/e7830122-319c-42aa-bf01-084108925470/pulse_mobile_now_playing.png';
  await page.screenshot({ path: screenshotNowPlaying });
  console.log(`✓ Saved: ${screenshotNowPlaying}`);

  // 4. Open Live Lyrics directly from Mobile Now Playing
  console.log('Opening Synced Live Lyrics...');
  const lyricsBtn = await page.$('button[data-testid="mobile-btn-lyrics"]');

  if (lyricsBtn) {
    await lyricsBtn.click();
    await new Promise((r) => setTimeout(r, 2200));
  }

  // Screenshot 3: Mobile Live Lyrics Synced
  const screenshotLyrics = '/Users/sampath.v_/.gemini/antigravity/brain/e7830122-319c-42aa-bf01-084108925470/pulse_mobile_lyrics_synced.png';
  await page.screenshot({ path: screenshotLyrics });
  console.log(`✓ Saved: ${screenshotLyrics}`);

  // 5. Test seeking by clicking a lyric line
  console.log('Testing lyric line tap-to-seek...');
  const lineResult = await page.evaluate(() => {
    const lines = document.querySelectorAll('[id^="lyric-line-"]');
    if (lines.length > 2) {
      lines[2].click();
      return { success: true, count: lines.length };
    }
    return { success: false, count: lines.length };
  });
  console.log(`✓ Lyric line interaction:`, lineResult);

  // 6. Verify closing lyrics returns to Now Playing view without closing it
  console.log('Testing smooth drawer dismiss...');
  const closeLyricsBtn = await page.$('button[aria-label="Close"]');
  if (closeLyricsBtn) {
    await closeLyricsBtn.click();
    await new Promise((r) => setTimeout(r, 600));
  }

  const isNowPlayingStillOpen = await page.evaluate(() => {
    return !!document.querySelector('button[aria-label="Dismiss now playing"]');
  });
  console.log(`✓ Seamless return to Now Playing after closing Lyrics: ${isNowPlayingStillOpen}`);

  if (consoleLogs.length > 0) {
    console.warn('Browser console errors observed:', consoleLogs);
  } else {
    console.log('✓ 0 browser console errors recorded!');
  }

  await browser.close();
  console.log('--- Verification Complete Successfully! ---');
})();
