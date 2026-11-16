// Открытие этапов комнаты. Порядок строгий:
//   «Слова» открыты всегда; «Проверка» — когда все слова комнаты прослушаны;
//   «Фразы» — когда все слова этапа «Фразы» выучены (верный ответ в «Проверке»).
import type { RoomDef } from '../content/types.ts';
import { isDue, isLearned, type WordProgress } from './srs.ts';
import type { Day } from './dates.ts';

export type StageId = 'words' | 'check' | 'phrases';
export const STAGES: StageId[] = ['words', 'check', 'phrases'];

export interface StageState {
  unlocked: boolean;
  done: boolean;
  n: number;
  total: number;
}

export type ProgressMap = Map<string, WordProgress>;

export function phraseWords(room: RoomDef) {
  return room.words.filter((w) => (w.phrases ?? []).length > 0 && (w.level ?? 1) === 1);
}

/** Этапы открываются по предметам уровня 1 (13 в комнате); детали уровня 2 их не закрывают. */
export function stageStates(room: RoomDef, pm: ProgressMap): Record<StageId, StageState> {
  const core = room.words.filter((w) => (w.level ?? 1) === 1);
  const total = core.length;
  const heard = core.filter((w) => (pm.get(w.id)?.heard ?? 0) > 0).length;
  const learned = core.filter((w) => isLearned(pm.get(w.id))).length;
  const pw = phraseWords(room);
  const pwLearned = pw.filter((w) => isLearned(pm.get(w.id))).length;
  const pwDone = pw.filter((w) => (pm.get(w.id)?.phraseCorrect ?? 0) > 0).length;
  return {
    words: { unlocked: true, done: heard === total, n: heard, total },
    check: { unlocked: heard === total, done: learned === total, n: learned, total },
    phrases: { unlocked: heard === total && pwLearned === pw.length, done: pwDone === pw.length, n: pwDone, total: pw.length },
  };
}

/** С какого этапа начинать, когда ребёнок заходит в комнату. */
export function firstOpenStage(states: Record<StageId, StageState>): StageId {
  for (const s of STAGES) if (states[s].unlocked && !states[s].done) return s;
  return 'check';
}

/**
 * Кого спрашивать в «Проверке»: сначала слова «к повторению» (раньше срок — раньше),
 * потом ещё не выученные, потом давно не спрашивали. Не повторяем только что спрошенное.
 */
export function pickCheckTarget(ids: string[], pm: ProgressMap, today: Day, avoid: string[], rnd = Math.random): string {
  const pool = ids.length > avoid.length ? ids.filter((id) => !avoid.includes(id)) : ids;
  const due = pool.filter((id) => isDue(pm.get(id), today)).sort((a, b) => (pm.get(a)!.dueDay! < pm.get(b)!.dueDay! ? -1 : 1));
  if (due.length) return due[0];
  const fresh = pool.filter((id) => !isLearned(pm.get(id)));
  if (fresh.length) return fresh[Math.floor(rnd() * fresh.length)];
  const by = [...pool].sort((a, b) => (pm.get(a)?.lastAsked ?? 0) - (pm.get(b)?.lastAsked ?? 0));
  const oldest = by.slice(0, Math.max(1, Math.ceil(by.length / 2)));
  return oldest[Math.floor(rnd() * oldest.length)];
}

/** Цель этапа «Фразы»: реже всего верно выполненные фразы. */
export function pickPhraseTarget(ids: string[], pm: ProgressMap, avoid: string[], rnd = Math.random): string {
  const pool = ids.length > avoid.length ? ids.filter((id) => !avoid.includes(id)) : ids;
  const min = Math.min(...pool.map((id) => pm.get(id)?.phraseCorrect ?? 0));
  const c = pool.filter((id) => (pm.get(id)?.phraseCorrect ?? 0) === min);
  return c[Math.floor(rnd() * c.length)];
}

export function shuffle<T>(a: T[], rnd = Math.random): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
