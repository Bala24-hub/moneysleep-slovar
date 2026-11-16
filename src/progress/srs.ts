// Интервальное повторение 1 · 3 · 7 дней (билет 02, п. 3).
// Выучено = первый верный ответ в «Проверке» → к повторению через 1 день, потом через 3, потом через 7.
// Ошибка сбрасывает интервал на 1 день.
import { addDays, type Day } from './dates.ts';

export const INTERVALS = [1, 3, 7] as const;
/** step: 0 — не выучено; 1..3 — ждём повторения через INTERVALS[step-1]; 4 — все повторения пройдены. */
export type Step = 0 | 1 | 2 | 3 | 4;

export interface WordProgress {
  lang: string;
  wordId: string;
  roomId: string;
  heard: number;
  correct: number;
  wrong: number;
  learnedDay: Day | null;
  step: Step;
  dueDay: Day | null;
  phraseCorrect: number;
  lastAsked: number;
}

export function emptyProgress(lang: string, roomId: string, wordId: string): WordProgress {
  return { lang, wordId, roomId, heard: 0, correct: 0, wrong: 0, learnedDay: null, step: 0, dueDay: null, phraseCorrect: 0, lastAsked: 0 };
}

export const isLearned = (p: WordProgress | undefined): boolean => !!p?.learnedDay;
export const isDue = (p: WordProgress | undefined, today: Day): boolean => !!p?.dueDay && today >= p.dueDay;

export function onCorrect(p: WordProgress, today: Day): WordProgress {
  const q = { ...p, correct: p.correct + 1 };
  if (!p.learnedDay) return { ...q, learnedDay: today, step: 1, dueDay: addDays(today, INTERVALS[0]) };
  if (p.step >= 1 && p.step <= 3 && isDue(p, today)) {
    const step = (p.step + 1) as Step;
    return { ...q, step, dueDay: step <= 3 ? addDays(today, INTERVALS[step - 1]) : null };
  }
  return q; // повторили раньше срока — интервал не меняем
}

export function onWrong(p: WordProgress, today: Day): WordProgress {
  const q = { ...p, wrong: p.wrong + 1 };
  if (!p.learnedDay) return q;
  return { ...q, step: 1, dueDay: addDays(today, INTERVALS[0]) };
}
