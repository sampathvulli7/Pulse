import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  page.on('request', (req) => {
    if (req.url().includes('pathfinder/v2/query')) {
      console.log('Pathfinder URL:', req.url());
      console.log('PostData:', req.postData());
    }
  });

  await page.goto('https://open.spotify.com/playlist/1AQ9Q5gDWQQEje14jGGLO2', {
    waitUntil: 'networkidle2',
  });

  await browser.close();
})();
