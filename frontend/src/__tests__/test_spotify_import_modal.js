import puppeteer from 'puppeteer-core';
import path from 'path';
import assert from 'assert';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function testSpotifyImportModal() {
  console.log('--- Testing Live Spotify Import Modal & Large Playlist Features in Browser ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('✓ Pulse web application loaded successfully.');

    // 1. Click "+" button in library header to open Create Menu
    await page.evaluate(() => {
      const plusBtn = document.querySelector('button[title*="Create playlist"]');
      if (plusBtn) plusBtn.click();
    });
    await delay(300);

    // Click "Import Spotify URL" in the menu
    const clickedImport = await page.evaluate(() => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const importBtn = allButtons.find((b) => b.innerText.includes('Import Spotify URL'));
      if (importBtn) {
        importBtn.click();
        return true;
      }
      return false;
    });

    assert(clickedImport, 'Failed to find Import Spotify URL button in create menu');
    await delay(600);

    // 2. Verify modal opened
    const modalText = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return modal ? modal.innerText : '';
    });

    assert(modalText.includes('Import Spotify Playlist'), 'Modal should display title');
    assert(modalText.includes('Playlist Link'), 'Modal should have Playlist Link tab');
    assert(modalText.includes('Paste All Tracks'), 'Modal should have Paste All Tracks tab');
    console.log('✓ Import Spotify Playlist modal opened with dual tabs.');

    // 3. Test clicking "Connect API Keys" expander
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const toggle = buttons.find((b) => b.innerText.includes('Connect API Keys') || b.innerText.includes('How to import'));
      if (toggle) toggle.click();
    });
    await delay(300);

    const hasClientIdInput = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.some((i) => i.placeholder && i.placeholder.includes('4a8b7'));
    });
    assert(hasClientIdInput, 'Should display Client ID & Secret configuration fields');
    console.log('✓ Expandable Spotify API Credentials revealed.');

    // 4. Switch to "Paste All Tracks (Cmd+A)" tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const pasteTab = buttons.find((b) => b.innerText.includes('Paste All Tracks'));
      if (pasteTab) pasteTab.click();
    });
    await delay(300);

    const textareaExists = await page.evaluate(() => {
      const ta = document.querySelector('textarea');
      return !!ta;
    });
    assert(textareaExists, 'Bulk textarea should be present in Paste All Tracks tab');
    console.log('✓ Successfully switched to "Paste All Tracks (Cmd+A)" tab.');

    // 5. Test bulk input detection
    const samplePaste = [
      'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
      'https://open.spotify.com/track/6rqhFgbbKwnb9MLmUQDhG6',
      'The Weeknd - Blinding Lights',
      'Dua Lipa - Levitating',
      'Queen - Bohemian Rhapsody',
    ].join('\n');

    await page.type('textarea', samplePaste);
    await delay(300);

    const countText = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return modal ? modal.innerText : '';
    });
    assert(countText.includes('5 tracks detected'), 'Should detect 5 tracks in clipboard');
    console.log('✓ Live track counter correctly verified 5 tracks.');

    console.log('\n=========================================');
    console.log('SPOTIFY IMPORT MODAL VERIFICATION PASSED (100%)');
    console.log('=========================================\n');
  } finally {
    await browser.close();
  }
}

testSpotifyImportModal().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
