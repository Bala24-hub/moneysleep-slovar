import { describe, expect, it } from 'vitest';
import { addDays, weekStart } from '../src/progress/dates.ts';
import { emptyProgress, isDue, onCorrect, onWrong, type WordProgress } from '../src/progress/srs.ts';

const D0 = '2026-11-16';
const fresh = () => emptyProgress('en-US', 'kitchen', 'kitchen.cup');

describe('повторение 1 · 3 · 7', () => {
  it('первый верный ответ → выучено, повтор завтра', () => {
    const p = onCorrect(fresh(), D0);
    expect(p.learnedDay).toBe(D0);
    expect(p.step).toBe(1);
    expect(p.dueDay).toBe('2026-11-17');
    expect(isDue(p, D0)).toBe(false);
    expect(isDue(p, '2026-11-17')).toBe(true);
  });

  it('1 → 3 → 7 → пройдено', () => {
    let p = onCorrect(fresh(), D0);
    p = onCorrect(p, '2026-11-17');
    expect([p.step, p.dueDay]).toEqual([2, '2026-11-20']);
    p = onCorrect(p, '2026-11-20');
    expect([p.step, p.dueDay]).toEqual([3, '2026-11-27']);
    p = onCorrect(p, '2026-11-28'); // опоздали на день — тоже засчитываем
    expect([p.step, p.dueDay]).toEqual([4, null]);
    expect(isDue(p, '2027-01-01')).toBe(false);
  });

  it('верный ответ раньше срока интервал не двигает', () => {
    const p = onCorrect(fresh(), D0);
    const q = onCorrect(p, D0);
    expect([q.step, q.dueDay, q.correct]).toEqual([1, '2026-11-17', 2]);
  });

  it('ошибка сбрасывает интервал на 1 день', () => {
    let p = onCorrect(fresh(), D0);
    p = onCorrect(p, '2026-11-17');
    p = onWrong(p, '2026-11-18');
    expect([p.step, p.dueDay, p.wrong]).toEqual([1, '2026-11-19', 1]);
  });

  it('ошибка до выучивания — только счётчик', () => {
    const p = onWrong(fresh(), D0);
    expect([p.learnedDay, p.step, p.dueDay, p.wrong]).toEqual([null, 0, null, 1]);
  });

  it('ошибка после «пройдено» возвращает слово в повторение', () => {
    let p: WordProgress = { ...onCorrect(fresh(), D0), step: 4, dueDay: null };
    p = onWrong(p, '2026-12-24');
    expect([p.step, p.dueDay]).toEqual([1, '2026-12-25']);
  });
});

describe('даты', () => {
  it('переход через месяц и год', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-28', 3)).toBe('2026-03-31');
  });
  it('неделя с понедельника', () => {
    expect(weekStart('2026-11-16')).toBe('2026-11-16'); // пн
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // вс
  });
});
