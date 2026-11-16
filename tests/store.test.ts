import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import room from '../content/rooms/kitchen.json';
import type { RoomDef } from '../src/content/types.ts';
import { daysOf, resetDbForTests } from '../src/progress/db.ts';
import { Progress } from '../src/progress/store.ts';

const R = room as unknown as RoomDef;

beforeEach(async () => {
  await resetDbForTests();
  indexedDB.deleteDatabase('moneysleep');
});

describe('прогресс в IndexedDB', () => {
  it('сохраняется и читается заново, отдельно по языкам', async () => {
    let t = new Date(2026, 10, 16, 10).getTime();
    const p = await Progress.load('en-US', () => t);
    for (const w of R.words) await p.heard(R, w.id);
    expect(p.stages(R).check.unlocked).toBe(true);
    expect(await p.answer(R, 'kitchen.cup', true)).toBe(true);
    expect(await p.answer(R, 'kitchen.cup', true)).toBe(false);
    await p.answer(R, 'kitchen.fork', false);
    await p.addCoin();

    const again = await Progress.load('en-US', () => t);
    expect(again.get(R, 'kitchen.cup').dueDay).toBe('2026-11-17');
    expect(again.get(R, 'kitchen.fork').wrong).toBe(1);
    expect(again.coins).toBe(1);
    const days = await daysOf('en-US');
    expect(days).toHaveLength(1);
    expect([days[0].answers, days[0].correct]).toEqual([3, 2]);

    const de = await Progress.load('de-DE', () => t);
    expect(de.stages(R).check.unlocked).toBe(false);
    t += 86_400_000;
    expect(again.today).toBe('2026-11-17');
  });
});
