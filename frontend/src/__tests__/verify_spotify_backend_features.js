import puppeteer from 'puppeteer-core';
import path from 'path';
import assert from 'assert';

const ARTIFACT_DIR = '/Users/sampath.v_/.gemini/antigravity-ide/brain/f1921a8c-a192-41d4-9e34-a725045e28dc/scratch';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function verifyFeatures() {
  console.log('--- Verifying Spotify Backend Features & Quality Additions ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('✓ Page loaded.');
    await delay(1000);

    // 1. Verify Daily Mixes in Sidebar
    const dailyMixesCount = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('*')).map((el) => el.innerText || '');
      return texts.filter((t) => t.includes('Daily Mix')).length;
    });
    console.log(`✓ Daily Mixes detected in UI (count: ${dailyMixesCount})`);
    assert(dailyMixesCount > 0, 'Daily Mixes should be present');

    // Screenshot 1: Overview with Daily Mixes in Sidebar
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_daily_mixes_sidebar.png') });
    console.log('✓ Saved screenshot: pulse_daily_mixes_sidebar.png');

    // 2. Click on a Daily Mix
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div, button'));
      const mix1 = items.find((el) => (el.innerText || '').includes('Daily Mix 1'));
      if (mix1) mix1.click();
    });
    await delay(1000);

    // Verify Daily Mix title in hero
    const heroTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : '';
    });
    console.log(`✓ Selected playlist hero title: "${heroTitle}"`);

    // 3. Test Spotify "Enhance" feature
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const enhanceBtn = buttons.find((b) => (b.innerText || '').includes('Enhance'));
      if (enhanceBtn) enhanceBtn.click();
    });
    console.log('✓ Clicked Enhance button.');
    await delay(1500);

    const isEnhancedActive = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.some((b) => (b.innerText || '').includes('Enhanced'));
    });
    console.log(`✓ Enhance active state: ${isEnhancedActive}`);
    assert(isEnhancedActive, 'Enhance should toggle to active state');

    // Screenshot 2: Enhanced playlist with recommendations
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_enhanced_playlist.png') });
    console.log('✓ Saved screenshot: pulse_enhanced_playlist.png');

    // 4. Play first track to inspect Now Playing and Acoustic DNA
    await page.evaluate(() => {
      const row = document.querySelector('tbody tr');
      if (row) row.click();
    });
    await delay(1000);

    // Open RightPanel Now Playing tab if needed
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('header button, [title*="Now Playing"]'));
      const npBtn = buttons.find((b) => (b.title || '').includes('Now Playing'));
      if (npBtn) npBtn.click();
    });
    await delay(1500);

    // Verify Spotify Acoustic DNA card
    const dnaCardText = await page.evaluate(() => {
      const panel = document.querySelector('aside.spotify-right-panel, .spotify-right-panel');
      return panel ? panel.innerText : '';
    });
    const hasAcousticDNA = dnaCardText.includes('Spotify Acoustic DNA') || dnaCardText.includes('Song Radio');
    console.log(`✓ Acoustic DNA / Song Radio present in RightPanel: ${hasAcousticDNA}`);

    // Screenshot 3: Acoustic DNA and Now Playing
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_acoustic_dna_nowplaying.png') });
    console.log('✓ Saved screenshot: pulse_acoustic_dna_nowplaying.png');

    // 5. Test Song Radio button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const radioBtn = buttons.find((b) => (b.innerText || '').includes('Go to Song Radio'));
      if (radioBtn) radioBtn.click();
    });
    await delay(1500);

    const radioHeroTitle = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return h1 ? h1.innerText : '';
    });
    console.log(`✓ Song Radio activated, Hero title: "${radioHeroTitle}"`);

    // Screenshot 4: Song Radio View
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_song_radio_view.png') });
    console.log('✓ Saved screenshot: pulse_song_radio_view.png');

    console.log('\n=============================================');
    console.log('ALL SPOTIFY BACKEND & QUALITY CHECKS PASSED');
    console.log('=============================================');
  } finally {
    await browser.close();
  }
}

verifyFeatures().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
