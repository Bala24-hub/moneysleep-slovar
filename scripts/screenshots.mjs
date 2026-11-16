// Скриншоты кухни на iPad для согласования: node scripts/screenshots.mjs [url]
// Нужен запущенный dev-сервер (npm run dev). Пишет в docs/screenshots/.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

// playwright в окружении стоит глобально (не в зависимостях проекта)
const { chromium } = createRequire(import.meta.url)('playwright');
const APP = process.argv[2] ?? 'http://localhost:5173/';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function session(viewport, dpr = 2) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.error('PAGEERROR', e.message));
  await p.goto(APP);
  await p.waitForFunction(() => !!window.__ms);
  await p.waitForTimeout(800);
  return p;
}
const shot = (p, name) => p.screenshot({ path: OUT + name + '.png' }).then(() => console.log('✓', name));
const ms = (p, fn, ...a) => p.evaluate(([f, args]) => window.__ms[f](...args), [fn, a]);
async function tap(p, id) {
  const r = await ms(p, 'rect', id);
  if (!r) throw new Error('нет на экране: ' + id);
  await p.mouse.click(r.x, r.y);
}
const idle = (p) => p.waitForFunction(() => { const s = window.__ms.state(); return s && !s.busy && !!s.target; }, null, { timeout: 15000 });

// ---------------------------------------------------------------- iPad 10/Air, горизонтально
const p = await session({ width: 1180, height: 820 });
await shot(p, '01-start');
await p.mouse.click(590, 640);
await p.waitForSelector('.screen.home:not(.screen-out)');
await p.waitForTimeout(3600);
await shot(p, '02-home');

// 1. Слова
await ms(p, 'room', 'words');
await p.waitForTimeout(900);
await tap(p, 'kitchen.fridge');
await p.waitForTimeout(420);
await shot(p, '03-words-room');
await tap(p, 'kitchen.cup');
await p.waitForTimeout(1400);
await shot(p, '04-words-table');

// 2. Проверка
await ms(p, 'heardAll');
await ms(p, 'next', 'kitchen.chair');
await ms(p, 'room', 'check');
await idle(p);
await p.waitForTimeout(500);
await shot(p, '05-check-question');
await ms(p, 'next', 'kitchen.cup');
await tap(p, 'kitchen.chair');
await p.waitForTimeout(520);
await shot(p, '06-check-correct');
await p.waitForFunction(() => window.__ms.state().target === 'kitchen.cup' && !window.__ms.state().busy, null, { timeout: 15000 });
await p.waitForTimeout(700);
await shot(p, '07-check-table-question');
await tap(p, 'kitchen.fork');
await p.waitForTimeout(650);
await shot(p, '08-check-wrong');
await idle(p);
await p.waitForTimeout(600);
await shot(p, '09-check-two-choices');

// 3. Фразы
await ms(p, 'learnAll');
await ms(p, 'next', 'kitchen.cup');
await ms(p, 'room', 'phrases');
await idle(p);
await p.waitForTimeout(500);
await shot(p, '10-phrases-question');
await tap(p, 'kitchen.cup');
await p.waitForTimeout(520);
await shot(p, '11-phrases-fly');
await p.waitForTimeout(1050);
await shot(p, '12-phrases-thanks');
// докручиваем круг до конца (5 фраз)
for (let i = 0; i < 4; i++) {
  await idle(p);
  const t = (await ms(p, 'state')).target;
  await tap(p, t);
  await p.waitForTimeout(200);
}
await p.waitForSelector('.overlay', { timeout: 20000 });
await p.waitForTimeout(700);
await shot(p, '13-round-done');
await p.context().close();

// ---------------------------------------------------------------- iPhone, горизонтально
const ph = await session({ width: 844, height: 390 }, 3);
await ms(ph, 'heardAll');
await ms(ph, 'room', 'words');
await ph.waitForTimeout(900);
await tap(ph, 'kitchen.frying_pan');
await ph.waitForTimeout(420);
await shot(ph, '14-iphone-words');
await ph.context().close();

await browser.close();
