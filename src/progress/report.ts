// Данные для отчёта родителям без слов (билет 02, п. 2). Только цифры — вёрстка отдельно.
import type { RoomDef } from '../content/types.ts';
import { addDays, daysBetween, weekStart, type Day } from './dates.ts';
import type { DayStat } from './db.ts';
import { isDue, isLearned, type WordProgress } from './srs.ts';

export interface Report {
  /** 7 кружков пн..вс текущей недели: занимался ли. */
  week: boolean[];
  learned: number;
  total: number;
  /** Прирост выученных слов за последние 7 дней. */
  weekGain: number;
  /** Дней подряд (сегодня или по вчера включительно). */
  streak: number;
  /** % верных ответов за 7 дней (null — ответов не было). */
  accuracy: number | null;
  /** Минут в день в среднем за дни занятий последних 7 дней. */
  minutesPerDay: number;
  rooms: { id: string; icon: string; learned: number; total: number }[];
  /** «Повторить сегодня»: id слов, у которых подошёл срок. */
  repeatToday: string[];
}

const active = (d: DayStat | undefined) => !!d && (d.activeMs > 0 || d.answers > 0);

export function buildReport(args: {
  rooms: RoomDef[];
  plannedWords: number;
  words: WordProgress[];
  days: DayStat[];
  today: Day;
}): Report {
  const { rooms, words, days, today } = args;
  const byDay = new Map(days.map((d) => [d.day, d]));
  const pm = new Map(words.map((w) => [w.wordId, w]));
  const ws = weekStart(today);
  const week = Array.from({ length: 7 }, (_, i) => active(byDay.get(addDays(ws, i))));
  let streak = 0;
  let d = active(byDay.get(today)) ? today : addDays(today, -1);
  while (active(byDay.get(d))) {
    streak++;
    d = addDays(d, -1);
  }
  const last7 = days.filter((x) => daysBetween(x.day, today) >= 0 && daysBetween(x.day, today) < 7);
  const answers = last7.reduce((s, x) => s + x.answers, 0);
  const correct = last7.reduce((s, x) => s + x.correct, 0);
  const activeDays = last7.filter(active);
  const ms = activeDays.reduce((s, x) => s + x.activeMs, 0);
  const learnedWords = words.filter(isLearned);
  return {
    week,
    learned: learnedWords.length,
    total: args.plannedWords,
    weekGain: learnedWords.filter((w) => daysBetween(w.learnedDay!, today) < 7).length,
    streak,
    accuracy: answers ? Math.round((100 * correct) / answers) : null,
    minutesPerDay: activeDays.length ? Math.round(ms / 60000 / activeDays.length) : 0,
    // комната «13/13» — по предметам уровня 1; детали входят в общее «выучено» (130+)
    rooms: rooms.map((r) => {
      const core = r.words.filter((w) => (w.level ?? 1) === 1);
      return { id: r.id, icon: r.icon, learned: core.filter((w) => isLearned(pm.get(w.id))).length, total: core.length };
    }),
    repeatToday: words
      .filter((w) => isDue(w, today))
      .sort((a, b) => (a.dueDay! < b.dueDay! ? -1 : 1))
      .map((w) => w.wordId),
  };
}
