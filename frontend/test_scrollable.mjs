import puppeteer from 'puppeteer-core';

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });

  await page.goto('https://open.spotify.com/playlist/1AQ9Q5gDWQQEje14jGGLO2', {
    waitUntil: 'networkidle2',
  });

  // Find scrollable container
  const scrollInfo = await page.evaluate(() => {
    const main = document.querySelector('[data-testid="playlist-page"]') || document.querySelector('main') || document.querySelector('.main-view-container');
    const scrollables = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.overflowY === 'auto' || style.overflowY === 'scroll';
    });
    return {
      scrollableTags: scrollables.map(el => el.className || el.tagName),
      mainTag: main ? main.tagName : 'none'
    };
  });

  console.log('Scroll info:', scrollInfo);
  await browser.close();
})();
