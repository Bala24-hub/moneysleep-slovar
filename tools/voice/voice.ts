// Озвучка языковых пакетов голосом Mo (ElevenLabs). Офлайн-инструмент для ассетов — приложение ElevenLabs не вызывает.
//
//   npm run voice                                   сухой прогон: что озвучить, сколько знаков (ничего не тратит)
//   npm run voice -- --lang en-US,es-419 --yes      генерация (стоп, если знаков больше --max-chars, по умолчанию 2500)
//   npm run voice -- --only kitchen.cup --yes       только эти id
//   npm run voice -- --force mo.thank_you --yes     перезаписать эти id, даже если файл есть
//
// Ключа в коде нет: прокси среды подставляет заголовок xi-api-key для api.elevenlabs.io (сетевой секрет).
// NODE_USE_ENV_PROXY=1 (в npm-скрипте) — чтобы fetch в Node ходил через HTTPS_PROXY.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { formId } from '../../src/content/keys.ts';
import type { Line, Pack } from '../../src/content/types.ts';
import { ROOT, loadCatalog, loadPack } from '../../scripts/packs-lib.ts';
import { concatWithGaps, loudness, shape } from './audio.ts';

interface Config {
  voiceId: string;
  modelId: string;
  outputFormat: string;
  targetLufs: number;
  peakLimit: number;
  keepSilenceSec: number;
  silenceThresholdDb: number;
  previewGapSec: number;
  maxChars: number;
}
const CFG = JSON.parse(readFileSync(join(import.meta.dirname, 'config.json'), 'utf8')) as Config;

interface Item {
  lang: string;
  id: string;
  text: string;
  file: string; // относительно корня репозитория
  chars: number;
}

interface LogEntry {
  text: string;
  chars: number;
  voiceId: string;
  modelId: string;
  lufs: number;
  at: string;
}
type Log = Record<string, LogEntry>;

// ---------------------------------------------------------------- аргументы
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const list = (n: string): string[] | null => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1].split(',').map((s) => s.trim()).filter(Boolean) : null;
};
const num = (n: string, d: number) => {
  const v = list(n);
  return v ? Number(v[0]) : d;
};
const YES = flag('--yes');
const MAX = num('--max-chars', CFG.maxChars);
const ONLY = list('--only');
const FORCE = new Set(list('--force') ?? []);
const LANGS = list('--lang') ?? loadCatalog().languages.map((l) => l.lang);
/** Только обработать уже лежащие файлы (обрезка + громкость), без ElevenLabs и без кредитов. */
const RESHAPE = list('--reshape');
const chars = (t: string) => [...t].length;

// ---------------------------------------------------------------- что озвучивать (порядок как в pack.json)
function entries(pack: Pack): [string, Line][] {
  const out: [string, Line][] = [];
  for (const [id, w] of Object.entries(pack.words)) out.push([id, w], [formId(id), w.form]);
  out.push(...Object.entries(pack.phrases), ...Object.entries(pack.actions ?? {}), ...Object.entries(pack.matrix ?? {}), ...Object.entries(pack.mo));
  return out;
}

function plan(lang: string): { items: Item[]; noText: string[] } {
  const pack = loadPack(lang);
  if (!pack) throw new Error(`нет пакета content/packs/${lang}/pack.json`);
  const items: Item[] = [];
  const noText: string[] = [];
  for (const [id, line] of entries(pack)) {
    if (ONLY && !ONLY.includes(id)) continue;
    const file = join(pack.audioDir, line?.audio || `${id}.mp3`);
    const exists = existsSync(join(ROOT, file));
    if (exists && !FORCE.has(id)) continue;
    const text = line?.text?.trim() ?? '';
    if (!text) {
      noText.push(id);
      continue;
    }
    if (!file.endsWith('.mp3')) throw new Error(`${lang}/${id}: скрипт пишет только .mp3, а в пакете ${file}`);
    items.push({ lang, id, text, file, chars: chars(text) });
  }
  return { items, noText };
}

// ---------------------------------------------------------------- ElevenLabs
class Stop extends Error {}

async function tts(text: string): Promise<{ audio: Buffer; cost: number | null }> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${CFG.voiceId}?output_format=${CFG.outputFormat}`;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({ text, model_id: CFG.modelId }),
      });
    } catch (e) {
      const cause = (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message;
      throw new Stop(`нет связи с api.elevenlabs.io (${cause}). Нужен домен api.elevenlabs.io в «Доступ к сети» среды.`);
    }
    if (res.ok) {
      const cost = Number(res.headers.get('character-cost') ?? res.headers.get('x-character-count') ?? NaN);
      return { audio: Buffer.from(await res.arrayBuffer()), cost: Number.isFinite(cost) ? cost : null };
    }
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401 || res.status === 403)
      throw new Stop(`ElevenLabs ответил ${res.status}: ${body}\nКлюч не подставлен или не подходит: нужен «Сетевой секрет» среды для api.elevenlabs.io (путь /v1/text-to-speech/, заголовок xi-api-key).`);
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = 2000 * 2 ** (attempt - 1);
      console.log(`  … ${res.status}, повтор через ${wait / 1000} с`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Stop(`ElevenLabs ответил ${res.status}: ${body}`);
  }
}

// ---------------------------------------------------------------- журнал и прослушка
const logPath = (lang: string) => join(import.meta.dirname, 'log', `${lang}.json`);
const readLog = (lang: string): Log => (existsSync(logPath(lang)) ? JSON.parse(readFileSync(logPath(lang), 'utf8')) : {});
const writeLog = (lang: string, log: Log) => {
  mkdirSync(dirname(logPath(lang)), { recursive: true });
  writeFileSync(logPath(lang), JSON.stringify(log, null, 2) + '\n');
};

/** docs/audio-preview/<lang>-<комната>.mp3 — всё, что озвучено скриптом, в порядке pack.json. */
async function buildPreviews(lang: string): Promise<string[]> {
  const pack = loadPack(lang)!;
  const log = readLog(lang);
  const rooms = loadCatalog().rooms;
  const made: string[] = [];
  for (const [i, room] of rooms.entries()) {
    const ids = entries(pack)
      .map(([id, line]) => ({ id, file: join(ROOT, pack.audioDir, line?.audio || `${id}.mp3`) }))
      .filter(({ id, file }) => log[id] && existsSync(file))
      .filter(({ id }) => id.startsWith(`${room}.`) || id.includes(`.${room}.`) || (i === 0 && id.startsWith('mo.')));
    if (!ids.length) continue;
    const out = join(ROOT, 'docs/audio-preview', `${lang}-${room}.mp3`);
    mkdirSync(dirname(out), { recursive: true });
    await concatWithGaps(ids.map((x) => x.file), out, CFG.previewGapSec);
    made.push(`docs/audio-preview/${lang}-${room}.mp3 (${ids.length} строк)`);
  }
  return made;
}

// ---------------------------------------------------------------- обработка готовых файлов
/** --reshape id,…: перезаписывает ТОЛЬКО эти файлы тем же конвейером (обрезка тишины + громкость). Сеть не нужна. */
async function reshapeExisting(ids: string[]) {
  let n = 0;
  for (const lang of LANGS) {
    const pack = loadPack(lang)!;
    const byId = new Map(entries(pack));
    for (const id of ids) {
      if (!byId.has(id)) throw new Error(`${lang}: в пакете нет записи ${id}`);
      const file = join(ROOT, pack.audioDir, byId.get(id)?.audio || `${id}.mp3`);
      if (!existsSync(file)) throw new Error(`${lang}: нет файла ${file}`);
    }
    for (const id of ids) {
      const file = join(ROOT, pack.audioDir, byId.get(id)?.audio || `${id}.mp3`);
      const before = await loudness(file);
      const tmp = mkdtempSync(join(tmpdir(), 'ms-reshape-'));
      try {
        const src = join(tmp, 'src.mp3');
        writeFileSync(src, readFileSync(file));
        const part = file + '.part.mp3';
        const after = await shape(src, part, CFG);
        renameSync(part, file);
        n++;
        console.log(`  ✓ ${lang} ${id}: ${before.toFixed(1)} → ${after.toFixed(1)} LUFS`);
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }
  }
  console.log(`Обработано файлов: ${n}. Запросов к ElevenLabs: 0, кредиты не тратились.`);
}

// ---------------------------------------------------------------- main
async function main() {
  if (RESHAPE) return reshapeExisting(RESHAPE);
  console.log(`Голос Mo: ${CFG.voiceId} · ${CFG.modelId} · ${CFG.outputFormat}`);
  const all: Item[] = [];
  for (const lang of LANGS) {
    const { items, noText } = plan(lang);
    const sum = items.reduce((s, x) => s + x.chars, 0);
    console.log(`\n${lang}: озвучить ${items.length} строк, ${sum} знаков`);
    const w = Math.max(10, ...items.map((x) => x.id.length));
    for (const x of items) console.log(`  ${x.id.padEnd(w)}  ${String(x.chars).padStart(3)}  ${x.text}`);
    if (noText.length) console.log(`  без текста, пропущено: ${noText.length}${noText.length <= 6 ? ` (${noText.join(', ')})` : ''}`);
    all.push(...items);
  }
  const total = all.reduce((s, x) => s + x.chars, 0);
  console.log(`\nИтого: ${all.length} строк, ${total} знаков ≈ ${total} кредитов (1 знак = 1 кредит). Лимит --max-chars ${MAX}.`);

  if (!YES) {
    console.log('Сухой прогон: ничего не отправлено и не потрачено. Для генерации добавьте --yes.');
    return;
  }
  if (!all.length) return console.log('Озвучивать нечего.');
  if (total > MAX) {
    console.log(`Стоп: ${total} знаков больше лимита ${MAX}. Ничего не сгенерировано (поднимите --max-chars, если так задумано).`);
    process.exitCode = 2;
    return;
  }

  let spent = 0;
  let apiCost = 0;
  let done = 0;
  const touched = new Set<string>();
  const tmp = mkdtempSync(join(tmpdir(), 'ms-tts-'));
  try {
    for (const x of all) {
      const { audio, cost } = await tts(x.text);
      spent += x.chars;
      if (cost != null) apiCost += cost;
      const raw = join(tmp, 'raw.mp3');
      writeFileSync(raw, audio);
      const final = join(ROOT, x.file);
      const part = final + '.part.mp3';
      mkdirSync(dirname(final), { recursive: true });
      const lufs = await shape(raw, part, CFG);
      renameSync(part, final);
      const log = readLog(x.lang);
      log[x.id] = { text: x.text, chars: x.chars, voiceId: CFG.voiceId, modelId: CFG.modelId, lufs, at: new Date().toISOString() };
      writeLog(x.lang, log);
      touched.add(x.lang);
      done++;
      console.log(`  ✓ ${x.lang} ${x.id} (${x.chars} зн., ${lufs.toFixed(1)} LUFS)`);
    }
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    console.log(`\nОстановлено: ${e.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    console.log(`\nСгенерировано файлов: ${done} из ${all.length}; знаков отправлено: ${spent}${apiCost ? `; по ответу API списано: ${apiCost}` : ''}.`);
    for (const lang of touched) for (const p of await buildPreviews(lang)) console.log(`Прослушка: ${p}`);
    if (touched.size) {
      console.log('\nВалидатор:');
      try {
        console.log(execFileSync('node', [join(ROOT, 'scripts/validate-packs.ts'), ...touched], { encoding: 'utf8' }));
      } catch (e) {
        console.log((e as { stdout?: string }).stdout ?? String(e));
      }
    }
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
