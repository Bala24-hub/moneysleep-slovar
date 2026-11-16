// Иконки PWA из assets/mo/mo.svg (запускать вручную после изменения Mo): node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright в окружении стоит глобально (не в зависимостях проекта)
const { chromium } = createRequire(import.meta.url)('playwright');

const mo = readFileSync(new URL('../assets/mo/mo.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
for (const [name, size] of [['icon-512', 512], ['icon-192', 192], ['apple-touch-icon', 180]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;background:radial-gradient(circle at 50% 45%,#1d3a6b,#0B1A33 70%);display:grid;place-items:center"><div style="width:${size * 0.74}px;height:${size * 0.79}px;margin-top:${size * 0.04}px">${mo.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`);
  await page.screenshot({ path: new URL(`../public/icons/${name}.png`, import.meta.url).pathname });
  await page.close();
}
await browser.close();
console.log('ok');
