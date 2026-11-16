// Валидатор языковых пакетов: у каждого слова и фразы в каждом пакете есть текст и аудио.
//   node scripts/validate-packs.ts            — все языки из content/catalog.json
//   node scripts/validate-packs.ts de-DE      — один язык
//   --json                                    — отчёт в JSON
// Код выхода 1, если есть пропуски (ошибки). Предупреждения код выхода не меняют.
import { expectedEntries, formId } from '../src/content/keys.ts';
import type { Line, Pack } from '../src/content/types.ts';
import { audioExists, loadCatalog, loadPack, loadRooms, packPath } from './packs-lib.ts';

export interface Issue {
  id: string;
  what: 'text' | 'audio' | 'article' | 'pack' | 'extra' | 'second-question';
  detail: string;
}

export interface LangReport {
  lang: string;
  errors: Issue[];
  warnings: Issue[];
  total: number;
  complete: number;
}

const lineIssues = (id: string, l: Line | undefined, pack: Pack, audioId = id): Issue[] => {
  const out: Issue[] = [];
  if (!l || !l.text.trim()) out.push({ id, what: 'text', detail: 'нет текста' });
  if (!l || !audioExists(pack, l.audio))
    out.push({ id: audioId, what: 'audio', detail: l?.audio ? `нет файла ${pack.audioDir}/${l.audio}` : 'не указан файл' });
  return out;
};

export function validateLang(lang: string): LangReport {
  const cat = loadCatalog();
  const exp = expectedEntries(loadRooms(cat));
  const rep: LangReport = { lang, errors: [], warnings: [], total: 0, complete: 0 };
  const pack = loadPack(lang);
  if (!pack) {
    rep.errors.push({ id: lang, what: 'pack', detail: `нет файла ${packPath(lang)}` });
    return rep;
  }
  if (pack.lang !== lang) rep.errors.push({ id: lang, what: 'pack', detail: `в pack.json lang="${pack.lang}"` });
  const count = (issues: Issue[]) => {
    rep.total++;
    if (issues.length === 0) rep.complete++;
    rep.errors.push(...issues);
  };
  const hasArticle = (t: string, arts: string[]) => arts.length === 0 || arts.some((a) => t.startsWith(a + ' '));

  for (const id of exp.words) {
    const w = pack.words[id];
    count(lineIssues(id, w, pack));
    count(lineIssues(formId(id), w?.form, pack));
    const checks = [[w?.text, id, pack.articles ?? []], [w?.form?.text, formId(id), pack.formArticles ?? []]] as const;
    for (const [t, key, arts] of checks)
      if (t && !hasArticle(t, arts))
        rep.errors.push({ id: key, what: 'article', detail: `«${t}» без артикля (${arts.join('/')})` });
  }
  // Вопросы «Проверки»: нужен хотя бы один вид на слово, второй — желательно.
  const groups = new Map<string, string[]>();
  for (const ph of exp.phrases) groups.set(ph.group, [...(groups.get(ph.group) ?? []), ph.id]);
  for (const ids of groups.values()) {
    const per = ids.map((id) => ({ id, issues: lineIssues(id, pack.phrases[id], pack) }));
    const ok = per.filter((p) => p.issues.length === 0);
    rep.total++;
    if (ok.length > 0) {
      rep.complete++;
      for (const p of per)
        if (p.issues.length) rep.warnings.push({ id: p.id, what: 'second-question', detail: p.issues.map((i) => i.detail).join('; ') });
    } else {
      for (const p of per) rep.errors.push(...p.issues);
    }
  }
  for (const id of exp.mo) count(lineIssues(id, pack.mo[id], pack));

  const known = new Set([...exp.words, ...exp.phrases.map((p) => p.id), ...exp.mo]);
  for (const k of [...Object.keys(pack.words), ...Object.keys(pack.phrases), ...Object.keys(pack.mo)])
    if (!known.has(k)) rep.warnings.push({ id: k, what: 'extra', detail: 'запись не используется ни в одной комнате' });
  return rep;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const langs = args.filter((a) => !a.startsWith('--'));
  const list = langs.length ? langs : loadCatalog().languages.map((l) => l.lang);
  const reports = list.map(validateLang);
  if (json) {
    console.log(JSON.stringify(reports, null, 2));
  } else {
    for (const r of reports) {
      const mark = r.errors.length ? '✗' : '✓';
      console.log(`\n${mark} ${r.lang}: готово ${r.complete} из ${r.total}, пропусков ${r.errors.length}, предупреждений ${r.warnings.length}`);
      const byWhat = (what: Issue['what']) => r.errors.filter((e) => e.what === what);
      const noText = byWhat('text').map((e) => e.id);
      const noAudio = byWhat('audio').map((e) => e.id);
      if (noText.length) console.log(`  нет текста (${noText.length}): ${noText.join(', ')}`);
      if (noAudio.length) console.log(`  нет аудио (${noAudio.length}): ${noAudio.join(', ')}`);
      for (const e of r.errors.filter((e) => !['text', 'audio'].includes(e.what))) console.log(`  ${e.id}: ${e.detail}`);
      const second = r.warnings.filter((w) => w.what === 'second-question').map((w) => w.id);
      if (second.length) console.log(`  (желательно) второй вопрос проверки (${second.length}): ${second.join(', ')}`);
      for (const w of r.warnings.filter((w) => w.what !== 'second-question')) console.log(`  (предупреждение) ${w.id}: ${w.detail}`);
    }
  }
  process.exit(reports.some((r) => r.errors.length) ? 1 : 0);
}

if (import.meta.main ?? process.argv[1]?.endsWith('validate-packs.ts')) main();
