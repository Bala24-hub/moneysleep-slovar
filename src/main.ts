// только латиница: en/de/es (умлауты, ñ, ¿ ¡ входят в latin)
import '@fontsource/onest/latin-500.css';
import '@fontsource/onest/latin-700.css';
import '@fontsource/onest/latin-800.css';
import './styles.css';
import { createShow, type App } from './app.ts';
import { AudioEngine } from './audio/engine.ts';
import { cachePackOffline, loadCatalog, loadContent } from './content/loader.ts';
import { Speech } from './content/speech.ts';
import { getKv } from './progress/db.ts';
import type { LevelMode } from './progress/levels.ts';
import { Progress } from './progress/store.ts';
import { StartScreen } from './screens/start.ts';

// без масштабирования жестами и «резинки» на iPad
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

async function boot() {
  const root = document.getElementById('app')!;
  const catalog = await loadCatalog();
  const lang = await getKv('lang', catalog.defaultLang);
  const [content, progress, captions, levelMode] = await Promise.all([
    loadContent(catalog, lang),
    Progress.load(lang),
    getKv('captions', true),
    getKv<LevelMode>('levelMode', 'auto'),
  ]);
  document.documentElement.lang = lang;
  const audio = new AudioEngine();
  let lastTouch = 0;
  const app: App = {
    root,
    audio,
    content,
    speech: new Speech(content),
    progress,
    captions,
    levelMode,
    show: createShow(root),
    touched: () => (lastTouch = Date.now()),
  };

  // минуты в день: считаем, пока экран открыт и ребёнок касался его за последнюю минуту
  const TICK = 10_000;
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastTouch < 60_000) void progress.addActiveTime(TICK);
  }, TICK);

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').then(() => cachePackOffline(content)).catch(() => {});
  }

  if (import.meta.env.DEV) {
    const dev = await import('./dev.ts');
    dev.install(app);
  }

  app.show(new StartScreen(app));
}

boot().catch((e) => {
  console.error(e);
  document.body.classList.add('boot-error');
});
