const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.connect({
    browserURL: 'http://localhost:9222'
  });
  
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('gemini')) || pages[0];
  
  console.log('Current URL:', page.url());
  
  const textareas = await page.evaluate(() => {
    const elements = document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]');
    return Array.from(elements).map(el => ({
      tag: el.tagName,
      id: el.id,
      class: el.className,
      placeholder: el.placeholder,
      ariaLabel: el.getAttribute('aria-label'),
      role: el.getAttribute('role')
    }));
  });
  
  console.log('\nFound input elements:');
  console.log(JSON.stringify(textareas, null, 2));
  
  await browser.disconnect();
})();
