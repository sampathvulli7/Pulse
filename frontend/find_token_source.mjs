import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  let foundUrl = null;

  page.on('response', async (res) => {
    try {
      if (res.headers()['content-type']?.includes('application/json')) {
        const text = await res.text();
        if (text.includes('accessToken') || text.includes('token')) {
          const json = JSON.parse(text);
          if (json.accessToken) {
            console.log('✓ FOUND TOKEN ENDPOINT:', res.url());
            console.log('Token snippet:', json.accessToken.slice(0, 20));
            foundUrl = res.url();
          }
        }
      }
    } catch (e) {}
  });

  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
