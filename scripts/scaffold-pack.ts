// Создаёт или дополняет пакет языка всеми нужными записями (пустой текст, имя аудио = id.mp3).
// Существующие тексты не трогает.
//   node scripts/scaffold-pack.ts es-419 --articles el,la,los,las --form-articles un,una,unos,unas
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expectedEntries, formId } from '../src/content/keys.ts';
import type { Line, Pack, PackWord } from '../src/content/types.ts';
import { ROOT, loadCatalog, loadPack, loadRooms, packPath } from './packs-lib.ts';

const lang = process.argv[2];
if (!lang) {
  console.error('Использование: node scripts/scaffold-pack.ts <lang> [--articles a,b] [--form-articles c,d]');
  process.exit(2);
}
const opt = (name: string): string[] | null => {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1].split(',') : null;
};
const exp = expectedEntries(loadRooms(loadCatalog()));
const old = loadPack(lang);
const pack: Pack = {
  lang,
  version: old?.version ?? 1,
  audioDir: old?.audioDir ?? `assets/audio/${lang}`,
  articles: opt('--articles') ?? old?.articles ?? [],
  formArticles: opt('--form-articles') ?? old?.formArticles ?? [],
  words: {},
  phrases: {},
  mo: {},
};
const line = (id: string, prev?: Line): Line => ({ text: prev?.text ?? '', audio: prev?.audio || `${id}.mp3` });
for (const id of exp.words) {
  const p: PackWord | undefined = old?.words[id];
  pack.words[id] = { ...line(id, p), form: line(formId(id), p?.form) };
}
for (const ph of exp.phrases) pack.phrases[ph.id] = line(ph.id, old?.phrases[ph.id]);
for (const id of exp.mo) pack.mo[id] = line(id, old?.mo[id]);
// записи, которых больше нет в комнатах, сохраняем (валидатор о них предупредит)
for (const [k, v] of Object.entries(old?.words ?? {})) pack.words[k] ??= v;
for (const [k, v] of Object.entries(old?.phrases ?? {})) pack.phrases[k] ??= v;
for (const [k, v] of Object.entries(old?.mo ?? {})) pack.mo[k] ??= v;

const out = join(ROOT, packPath(lang));
mkdirSync(dirname(out), { recursive: true });
mkdirSync(join(ROOT, pack.audioDir), { recursive: true });
writeFileSync(out, JSON.stringify(pack, null, 2) + '\n');
console.log(`${packPath(lang)}: слов ${exp.words.length}, фраз ${exp.phrases.length}, реплик Mo ${exp.mo.length}`);
