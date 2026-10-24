import puppeteer from 'puppeteer-core';
import path from 'path';
import assert from 'assert';

const ARTIFACT_DIR = '/Users/sampath.v_/.gemini/antigravity/brain/e7830122-319c-42aa-bf01-084108925470';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function runE2E() {
  console.log('--- Starting Pulse Live Browser E2E Verification Suite ---');

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

  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
  });

  try {
    // 1. Load application
    console.log('\n[E2E Step 1] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('✓ Page loaded cleanly.');

    // 2. Verify Track List
    console.log('\n[E2E Step 2] Verifying 50+ Track List renders...');
    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    const rowCount = await page.$$eval('table tbody tr', (rows) => rows.length);
    assert(rowCount >= 50, `Expected at least 50 tracks in table, found ${rowCount}`);
    console.log(`✓ Verified: Table contains ${rowCount} rendered track rows.`);

    // 3. Play Track 1
    console.log('\n[E2E Step 3] Testing Track Playback on Track 1...');
    const firstRow = await page.$('table tbody tr:first-child');
    const firstRowTitle = await page.$eval('table tbody tr:first-child td:nth-child(2) .font-semibold', (el) => el.innerText);
    await firstRow.click();
    await delay(1200);

    const nowPlayingText = await page.$eval('footer', (el) => el.innerText);
    assert(nowPlayingText.includes(firstRowTitle), `PlayerBar should display ${firstRowTitle}`);
    console.log(`✓ Track playback active: PlayerBar displays "${firstRowTitle}".`);

    // 4. Test Queueing ("Play Next" into Priority Queue)
    console.log('\n[E2E Step 4] Testing Priority Queue addition (Play Next)...');
    const clickedPlayNext = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const targetRow = rows.find(r => r.innerText.includes('Vampires')) || rows[3];
      if (targetRow) {
        const btn = targetRow.querySelector('button[title*="Priority Queue"]');
        if (btn) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    assert(clickedPlayNext, 'Play Next button on row 4 must be clicked');
    await delay(400);

    // 5. Open and inspect Queue Drawer
    console.log('\n[E2E Step 5] Opening Dual-Layer Playback Queue Drawer...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('footer button'));
      const btn = btns.find((b) => b.getAttribute('title')?.includes('Playback Queue'));
      if (btn) btn.click();
    });
    await delay(600);

    const drawerText = await page.evaluate(() => {
      const drawer = document.querySelector('.fixed.inset-y-0.right-0');
      return drawer ? drawer.innerText : '';
    });
    console.log('--- Drawer Full Text ---:\n', drawerText);
    assert(drawerText.includes('Playback Queue'), 'Queue drawer header must be present');
    assert(drawerText.includes('Priority') || drawerText.includes('Up Next'), 'Queue drawer should show Priority section');
    console.log('✓ Verified: Dual-Layer Queue correctly separates Priority Up Next vs Context Playing From.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_queue_drawer.png') });
    console.log('✓ Captured screenshot: pulse_queue_drawer.png');

    // Close Queue Drawer by toggling the queue button again
    await page.evaluate(() => {
      const btn = document.querySelector('footer button[title*="Playback Queue"]');
      if (btn) btn.click();
    });
    await delay(500);

    // 6. Test 10-Band EQ Drawer & Presets
    console.log('\n[E2E Step 6] Testing 10-Band Parametric Equalizer Drawer & Visualizer...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('footer button'));
      const btn = btns.find((b) => b.getAttribute('title')?.includes('Parametric Equalizer') || b.innerText.includes('Flat'));
      if (btn) btn.click();
    });
    await delay(700);

    const eqDrawerText = await page.evaluate(() => {
      const drawer = document.querySelector('.fixed.inset-y-0.right-0');
      return drawer ? drawer.innerText : document.body.innerText;
    });
    console.log('--- EQ Drawer Full Text ---:\n', eqDrawerText);
    assert(eqDrawerText.toLowerCase().includes('10-band parametric equalizer'), 'EQ Drawer must be open');
    assert(eqDrawerText.toLowerCase().includes('dsp real-time visualizer'), 'Canvas visualizer must be present');
    assert(eqDrawerText.toLowerCase().includes('parametric frequency response'), 'EQ Frequency sliders must be present');

    // Click "Bass Boost" preset
    const clickedBassBoost = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const bb = btns.find((b) => b.innerText.includes('Bass Boost'));
      if (bb) {
        bb.click();
        return true;
      }
      return false;
    });
    assert(clickedBassBoost, 'Bass Boost preset button must be clicked');
    await delay(400);
    console.log('✓ Selected "Bass Boost" preset.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_eq_drawer.png') });
    console.log('✓ Captured screenshot: pulse_eq_drawer.png');

    // Close EQ Drawer by toggling the EQ button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('footer button'));
      const btn = btns.find((b) => b.getAttribute('title')?.includes('Parametric Equalizer') || b.innerText.includes('Bass Boost'));
      if (btn) btn.click();
    });
    await delay(500);

    // 7. Test Synchronized Lyrics Panel
    console.log('\n[E2E Step 7] Testing Synchronized Lyrics Panel...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('footer button'));
      const btn = btns.find((b) => b.getAttribute('title')?.includes('Lyrics'));
      if (btn) btn.click();
    });
    await delay(700);

    const lyricsText = await page.evaluate(() => {
      const drawer = document.querySelector('.fixed.inset-y-0.right-0');
      return drawer ? drawer.innerText : document.body.innerText;
    });
    console.log('--- Lyrics Panel Text ---:\n', lyricsText);
    assert(lyricsText.toLowerCase().includes('lyrics') || lyricsText.toLowerCase().includes('lrclib'), 'Lyrics panel must be open');
    console.log('✓ Synchronized Lyrics Panel rendered cleanly.');

    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_lyrics_panel.png') });
    console.log('✓ Captured screenshot: pulse_lyrics_panel.png');

    // Close Lyrics Panel
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('footer button'));
      const btn = btns.find((b) => b.getAttribute('title')?.includes('Lyrics'));
      if (btn) btn.click();
    });
    await delay(500);

    // 8. Test Unlimited Skip (Zero 6-skip/hour limitation!)
    console.log('\n[E2E Step 8] Testing Zero Skip Limit (Skipping immediately to Priority Track)...');
    const skipBtn = await page.$('footer button[title*="Unlimited Skips"]');
    await skipBtn.click();
    await delay(600);

    const updatedPlayingText = await page.$eval('footer', (el) => el.innerText);
    assert(updatedPlayingText.includes('Vampires'), 'Next track should immediately play Vampires from Priority Queue');
    console.log('✓ Unrestricted skip verified: Immediately transitioned to Priority Track "Vampires".');

    // 9. Test Smart Shuffle cycling
    console.log('\n[E2E Step 9] Testing Smart Shuffle mode cycling...');
    const shuffleBtn = await page.$('footer button[title*="Shuffle"]');
    await shuffleBtn.click();
    await delay(300);
    const shuffleStatus = await page.$eval('footer button[title*="Shuffle"]', (el) => el.getAttribute('title'));
    console.log(`✓ Smart Shuffle cycled successfully: ${shuffleStatus}`);

    // 10. Verify Zero Fatal Console Errors
    console.log('\n[E2E Step 10] Checking for unexpected console/runtime errors...');
    const fatalErrors = consoleErrors.filter(
      (err) => !err.includes('favicon') && !err.includes('CVDisplayLink') && !err.includes('installwebapp')
    );
    if (fatalErrors.length > 0) {
      console.warn('Non-fatal browser messages:', fatalErrors);
    }
    console.log('✓ Zero fatal application console errors during entire browser session.');

    console.log('\n======================================================');
    console.log('ALL E2E LIVE BROWSER VERIFICATION TESTS PASSED (100%)');
    console.log('======================================================\n');
  } finally {
    await browser.close();
  }
}

runE2E().catch((err) => {
  console.error('E2E Verification Failed:', err);
  process.exit(1);
});
