import { describe, expect, it } from 'vitest';
import room from '../content/rooms/kitchen.json';
import type { RoomDef } from '../src/content/types.ts';
import { emptyProgress, onCorrect, type WordProgress } from '../src/progress/srs.ts';
import { firstOpenStage, pickCheckTarget, pickPhraseTarget, stageStates, type ProgressMap } from '../src/progress/stages.ts';

const R = room as unknown as RoomDef;
// по нарисованным словам (у недорисованных нет зон — они этапы не держат)
const ids = R.words.filter((w) => Object.keys(w.zones).length).map((w) => w.id);
const D = '2026-11-16';
const mk = (f: (p: WordProgress) => WordProgress, only = ids): ProgressMap =>
  new Map(only.map((id) => [id, f(emptyProgress('en-US', 'kitchen', id))]));

describe('открытие этапов', () => {
  it('сначала открыты только «Слова»', () => {
    const s = stageStates(R, new Map());
    expect([s.words.unlocked, s.check.unlocked, s.phrases.unlocked]).toEqual([true, false, false]);
    expect(firstOpenStage(s)).toBe('words');
  });

  it('все слова прослушаны → открыта «Проверка»', () => {
    const s = stageStates(R, mk((p) => ({ ...p, heard: 1 })));
    expect([s.words.done, s.check.unlocked, s.phrases.unlocked]).toEqual([true, true, false]);
    expect(firstOpenStage(s)).toBe('check');
  });

  it('не хватает одного слова — «Проверка» закрыта', () => {
    const s = stageStates(R, mk((p) => ({ ...p, heard: 1 }), ids.slice(1)));
    expect(s.check.unlocked).toBe(false);
    expect(s.words.n).toBe(ids.length - 1);
  });

  it('предметы стола выучены → открыты «Фразы»', () => {
    const table = R.words.filter((w) => w.phrases).map((w) => w.id);
    const pm = mk((p) => ({ ...p, heard: 1 }));
    for (const id of table) pm.set(id, onCorrect(pm.get(id)!, D));
    const s = stageStates(R, pm);
    expect(s.phrases.unlocked).toBe(true);
    expect(s.phrases.total).toBe(5);
  });
});

describe('выбор вопроса', () => {
  it('сначала слова «к повторению»', () => {
    const pm = mk((p) => ({ ...onCorrect({ ...p, heard: 1 }, '2026-11-01'), step: 2, dueDay: '2026-11-20' }));
    pm.set('kitchen.chair', { ...pm.get('kitchen.chair')!, dueDay: '2026-11-15' });
    pm.set('kitchen.bowl', { ...pm.get('kitchen.bowl')!, dueDay: '2026-11-10' });
    expect(pickCheckTarget(ids, pm, D, [])).toBe('kitchen.bowl');
    expect(pickCheckTarget(ids, pm, D, ['kitchen.bowl'])).toBe('kitchen.chair');
  });

  it('потом не выученные, без повтора только что спрошенного', () => {
    const pm = mk((p) => onCorrect(p, D));
    pm.set('kitchen.cup', emptyProgress('en-US', 'kitchen', 'kitchen.cup'));
    pm.set('kitchen.fork', emptyProgress('en-US', 'kitchen', 'kitchen.fork'));
    expect(pickCheckTarget(ids, pm, D, ['kitchen.cup'], () => 0)).toBe('kitchen.fork');
  });

  it('фразы: реже всего сделанные', () => {
    const t = ['kitchen.cup', 'kitchen.plate', 'kitchen.spoon'];
    const pm = mk((p) => ({ ...p, phraseCorrect: 2 }), t);
    pm.set('kitchen.plate', { ...pm.get('kitchen.plate')!, phraseCorrect: 0 });
    expect(pickPhraseTarget(t, pm, [])).toBe('kitchen.plate');
  });
});
