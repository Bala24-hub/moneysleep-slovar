// Выход из приближения: скриншоты и видео для согласования (нужен npm run dev).
//   node scripts/screenshots-zoom.mjs [url]   → docs/screens/zoom/
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const APP = process.argv[2] ?? 'http://localhost:5173/';
const OUT = new URL('../docs/screens/zoom/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function open(ctxOpts) {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true, ...ctxOpts });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await p.goto(APP);
  await p.waitForFunction(() => !!window.__ms);
  await p.waitForTimeout(600);
  return p;
}
const ms = (p, fn, ...a) => p.evaluate(([f, args]) => window.__ms[f](...args), [fn, a]);
const tap = async (p, id) => {
  const r = await ms(p, 'rect', id);
  await p.mouse.click(r.x, r.y);
};
const shot = (p, name) => p.screenshot({ path: OUT + name + '.png' }).then(() => console.log('✓', name));
const tapBack = async (p) => {
  const r = await p.evaluate(() => { const b = document.querySelector('.back-btn').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await p.mouse.click(r.x, r.y);
};
const layers = (p) => p.evaluate(() => document.querySelectorAll('.zoom-layer').length);
/** Дождаться, что крупный план закрылся (анимация ~0,4 с). */
const closed = (p) => p.waitForFunction(() => !document.querySelector('.zoom-layer'), null, { timeout: 3000 }).then(() => true, () => false);
/** Щипок двумя пальцами (свести) через CDP. */
async function pinch(p, cx, cy) {
  const cdp = await p.context().newCDPSession(p);
  const pts = (d) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(220) });
  for (const d of [190, 150, 110, 80]) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) });
    await p.waitForTimeout(40);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

// ---------------------------------------------------------------- скриншоты (iPad, ×2)
const p = await open({ deviceScaleFactor: 2 });
await ms(p, 'room', 'words');
await p.waitForTimeout(800);
await tap(p, 'kitchen.cup');
await p.waitForTimeout(1000);
await shot(p, '15-zoom-open');
await p.waitForFunction(() => document.querySelector('.back-btn').classList.contains('nudge'), null, { timeout: 8000 });
await p.evaluate(() => {
  const a = document.querySelector('.back-btn').getAnimations()[0];
  a.pause();
  a.currentTime = 1550; // пик покачивания
});
await shot(p, '16-zoom-nudge');
await p.evaluate(() => document.querySelector('.back-btn').getAnimations()[0].play());
// проверки выхода: серый фон, стрелка, щипок
await p.mouse.click(60, 560);
console.log('серый фон → назад:', await closed(p));
await tap(p, 'kitchen.plate');
await p.waitForTimeout(900);
await tapBack(p);
console.log('стрелка → назад:', await closed(p));
await tap(p, 'kitchen.bowl');
await p.waitForTimeout(900);
await pinch(p, 560, 450);
console.log('щипок → назад:', await closed(p));

await ms(p, 'heardAll');
await ms(p, 'next', 'kitchen.cup');
await ms(p, 'room', 'check');
await p.waitForFunction(() => { const s = window.__ms.state(); return s && !s.busy && s.target; }, null, { timeout: 15000 });
await p.waitForTimeout(600);
await shot(p, '17-zoom-check');
await p.mouse.click(60, 560);
await p.waitForTimeout(500);
console.log('в «Проверке» серый фон не уводит назад:', (await layers(p)) === 1);
await p.context().close();

// ---------------------------------------------------------------- видео (iPad, ×1)
const vdir = mkdtempSync(join(tmpdir(), 'ms-video-'));
const v = await open({ deviceScaleFactor: 1, recordVideo: { dir: vdir, size: { width: 1180, height: 820 } } });
await ms(v, 'room', 'words');
await v.waitForTimeout(1200);
await tap(v, 'kitchen.cup');
await v.waitForTimeout(8500); // 5 с тишины → стрелка покачивается
await v.mouse.click(60, 560); // серый фон → назад
await v.waitForTimeout(1600);
await tap(v, 'kitchen.spoon');
await v.waitForTimeout(2200);
await tapBack(v); // стрелка → назад
await v.waitForTimeout(1500);
await v.context().close();
const webm = join(vdir, readdirSync(vdir).find((f) => f.endsWith('.webm')));
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', OUT + 'zoom-demo.mp4']);
rmSync(vdir, { recursive: true, force: true });
console.log('✓ zoom-demo.mp4');
await browser.close();
