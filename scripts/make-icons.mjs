// Renders the PWA icons from an inline SVG using the pre-installed Chromium.
import { chromium } from 'playwright';
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${pad ? 0 : 96}" fill="#1f5eff"/>
<g transform="translate(${pad ? 96 : 64} ${pad ? 96 : 64}) scale(${pad ? 0.625 : 0.75})" fill="#fff">
<rect x="40" y="300" width="70" height="110" rx="10" opacity=".55"/><rect x="140" y="240" width="70" height="170" rx="10" opacity=".7"/>
<rect x="240" y="170" width="70" height="240" rx="10" opacity=".85"/><rect x="340" y="90" width="70" height="320" rx="10"/>
<rect x="340" y="90" width="70" height="60" rx="10" fill="#5fd38a"/></g></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['icon-maskable-512', 512, true], ['apple-touch-icon', 180, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/icons/${name}.png`, omitBackground: true });
}
await browser.close();
console.log('icons written');
