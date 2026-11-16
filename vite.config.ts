import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const ROOT = import.meta.dirname;
/** Что из репозитория нужно приложению во время работы (оригиналы сцен не нужны). */
const RUNTIME = ['content', 'assets/scenes/app', 'assets/mo', 'assets/audio'];
const AUDIO = /\.(mp3|m4a)$/i;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const packLangs = () => readdirSync(join(ROOT, 'content/packs')).filter((d) => existsSync(join(ROOT, 'content/packs', d, 'pack.json')));
function audioIndex(lang: string): string[] {
  const pack = JSON.parse(readFileSync(join(ROOT, 'content/packs', lang, 'pack.json'), 'utf8')) as { audioDir: string };
  const dir = join(ROOT, pack.audioDir);
  return existsSync(dir) ? readdirSync(dir).filter((f) => AUDIO.test(f)).sort() : [];
}

/** Контент и ассеты как статика + audio-index.json по языкам + service worker со списком файлов. */
function content(): Plugin {
  return {
    name: 'moneysleep-content',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/^\/content\/packs\/([^/]+)\/audio-index\.json/);
        if (!m) return next();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(audioIndex(decodeURIComponent(m[1]))));
      });
    },
    generateBundle(_o, bundle) {
      const files = RUNTIME.flatMap((d) => walk(join(ROOT, d))).filter((f) => !f.endsWith('.gitkeep') && !f.endsWith('README.md'));
      const hash = createHash('sha256');
      for (const f of files) {
        const fileName = relative(ROOT, f);
        const source = readFileSync(f);
        hash.update(fileName).update(source);
        this.emitFile({ type: 'asset', fileName, source });
      }
      for (const lang of packLangs())
        this.emitFile({ type: 'asset', fileName: `content/packs/${lang}/audio-index.json`, source: JSON.stringify(audioIndex(lang)) });
      // в установочный кэш — всё, кроме аудио (оно кэшируется по выбранному языку)
      const shell = ['/', '/index.html', ...Object.keys(bundle).map((k) => '/' + k), ...files.map((f) => '/' + relative(ROOT, f))]
        .filter((p) => !AUDIO.test(p) && !p.startsWith('/content/packs/') && !p.endsWith('.woff'));
      for (const k of Object.keys(bundle)) hash.update(k);
      const tpl = readFileSync(join(ROOT, 'sw/sw.js'), 'utf8');
      hash.update(tpl);
      const sw = tpl
        .replace("'__VERSION__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
        .replace('= __PRECACHE__;', `= ${JSON.stringify([...new Set(shell)])};`);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  plugins: [content()],
  build: {
    assetsDir: 'app',
    target: 'safari15',
  },
  server: { host: true },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
} as Parameters<typeof defineConfig>[0]);
