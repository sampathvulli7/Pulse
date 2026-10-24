import puppeteer from 'puppeteer-core';
import path from 'path';
import assert from 'assert';

const ARTIFACT_DIR = '/Users/sampath.v_/.gemini/antigravity/brain/e7830122-319c-42aa-bf01-084108925470';
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function testSpotifySearch() {
  console.log('--- Testing Live Spotify Search Modal in Browser ---');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('✓ Page loaded.');

    // Click "Search Spotify" in the sidebar
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const spotBtn = btns.find((b) => b.innerText.includes('Search Spotify'));
      if (spotBtn) spotBtn.click();
    });
    await delay(500);

    // Verify modal is open
    const modalTitle = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return modal ? modal.innerText : '';
    });
    assert(modalTitle.includes('Spotify & Global Music Search'), 'Spotify search modal should be open');
    console.log('✓ Spotify Search Modal opened.');

    // Type query "Daft Punk"
    const input = await page.$('.fixed.inset-0 input');
    await input.type('Daft Punk', { delay: 40 });
    await delay(1200); // Wait for debounce and search result

    // Check results
    const resultsCount = await page.$$eval('.fixed.inset-0 .group', (items) => items.length);
    assert(resultsCount > 0, 'Expected search results for Daft Punk');
    console.log(`✓ Found ${resultsCount} search results for "Daft Punk".`);

    // Capture screenshot of the modal
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'pulse_spotify_search_modal.png') });
    console.log('✓ Captured screenshot: pulse_spotify_search_modal.png');

    console.log('\n=========================================');
    console.log('SPOTIFY SEARCH VERIFICATION PASSED (100%)');
    console.log('=========================================\n');
  } finally {
    await browser.close();
  }
}

testSpotifySearch().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
