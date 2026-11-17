import { describe, expect, it } from 'vitest';
import room from '../content/rooms/kitchen.json';
import type { RoomDef } from '../src/content/types.ts';
import { hasAccess } from '../src/content/entitlements.ts';
import { buildReport } from '../src/progress/report.ts';
import { emptyProgress, onCorrect } from '../src/progress/srs.ts';

const R = room as unknown as RoomDef;
const day = (d: string, activeMs = 600_000, answers = 10, correct = 8) => ({ lang: 'en-US', day: d, activeMs, answers, correct });

describe('отчёт родителям', () => {
  it('считает недели, серию, точность и повторения', () => {
    const w = (id: string, learned: string) => onCorrect(emptyProgress('en-US', 'kitchen', id), learned);
    const words = [w('kitchen.cup', '2026-11-19'), w('kitchen.fork', '2026-11-01'), emptyProgress('en-US', 'kitchen', 'kitchen.bowl')];
    const r = buildReport({
      rooms: [R],
      plannedWords: 130,
      words,
      days: [day('2026-11-16'), day('2026-11-17'), day('2026-11-19'), day('2026-11-20', 1_200_000, 10, 10)],
      today: '2026-11-20',
    });
    expect(r.week).toEqual([true, true, false, true, true, false, false]);
    expect(r.streak).toBe(2);
    expect([r.learned, r.total, r.weekGain]).toEqual([2, 130, 1]);
    expect(r.accuracy).toBe(85);
    expect(r.minutesPerDay).toBe(13);
    expect(r.rooms[0]).toEqual({ id: 'kitchen', icon: 'frying_pan', learned: 2, total: 15 });
    expect(r.repeatToday).toEqual(['kitchen.fork', 'kitchen.cup']);
  });

  it('серия считается по вчера, если сегодня ещё не занимались', () => {
    const r = buildReport({ rooms: [R], plannedWords: 130, words: [], days: [day('2026-11-18'), day('2026-11-19')], today: '2026-11-20' });
    expect(r.streak).toBe(2);
    expect(r.accuracy).toBe(80);
  });
});

describe('доступ по языкам', () => {
  const free = [{ lang: '*', room: 'kitchen' }];
  it('кухня бесплатно на любом языке', () => {
    expect(hasAccess(free, [], 'de-DE', 'kitchen')).toBe(true);
    expect(hasAccess(free, [], 'en-US', 'bathroom')).toBe(false);
  });
  it('покупка одного языка или всех', () => {
    expect(hasAccess(free, [{ lang: 'en-US', room: '*' }], 'en-US', 'bathroom')).toBe(true);
    expect(hasAccess(free, [{ lang: 'en-US', room: '*' }], 'es-419', 'bathroom')).toBe(false);
    expect(hasAccess(free, [{ lang: '*', room: '*' }], 'es-419', 'bathroom')).toBe(true);
  });
});
