import { describe, expect, it } from 'vitest';
import kitchen from '../content/rooms/kitchen.json';
import type { RoomDef } from '../src/content/types.ts';
import { checkPool, childScenes, coreWords, maxLevel, openerScene, sceneChain, wordsInScene } from '../src/progress/levels.ts';
import { emptyProgress, onCorrect, type WordProgress } from '../src/progress/srs.ts';
import { stageStates } from '../src/progress/stages.ts';

// Кухня + пример деталей: холодильник → внутри (freezer, shelf) → полка (milk, eggs). Только для теста.
const base = kitchen as unknown as RoomDef;
const sq = [[0, 0], [100, 0], [100, 100], [0, 100]] as [number, number][];
const R: RoomDef = {
  ...base,
  scenes: {
    ...base.scenes,
    'kitchen.fridge.inside': { image: 'x.jpg', width: 1152, height: 760, parent: 'kitchen', zoomFrom: [46, 148, 224, 148], opener: 'kitchen.fridge', level: 2 },
    'kitchen.fridge.shelf': { image: 'y.jpg', width: 1152, height: 760, parent: 'kitchen.fridge.inside', zoomFrom: [0, 0, 576, 380], opener: 'kitchen.shelf', level: 2 },
  },
  words: [
    ...base.words,
    { id: 'kitchen.freezer', scene: 'kitchen.fridge.inside', level: 2, zones: { 'kitchen.fridge.inside': sq } },
    { id: 'kitchen.shelf', scene: 'kitchen.fridge.inside', level: 2, zones: { 'kitchen.fridge.inside': sq } },
    { id: 'kitchen.milk', scene: 'kitchen.fridge.shelf', level: 2, zones: { 'kitchen.fridge.shelf': sq } },
  ],
};
const D = '2026-11-16';
const core = coreWords(base).map((w) => w.id);
const pmOf = (f: (id: string) => WordProgress) => new Map(R.words.map((w) => [w.id, f(w.id)]));
const fresh = (id: string) => emptyProgress('en-US', 'kitchen', id);

describe('уровни', () => {
  it('в кухне 20 слов уровня 1, из них 15 уже на картинке', () => {
    expect(base.words).toHaveLength(20);
    expect(base.words.every((w) => (w.level ?? 1) === 1)).toBe(true);
    expect(coreWords(base)).toHaveLength(15);
  });

  it('слова без зон не мешают: этапы открываются по нарисованным', () => {
    const placed = coreWords(base).map((w) => w.id);
    const heard = new Map(placed.map((id) => [id, { ...fresh(id), heard: 1 }]));
    const st = stageStates(base, heard);
    expect([st.words.done, st.words.total, st.check.unlocked]).toEqual([true, 15, true]);
    expect(checkPool(base, heard, 1)).not.toContain('kitchen.sink');
  });

  it('уровень 2 открывается, когда выучены все предметы уровня 1', () => {
    expect(maxLevel(R, pmOf(fresh))).toBe(1);
    const almost = pmOf((id) => (id === 'kitchen.bowl' || !core.includes(id) ? fresh(id) : onCorrect(fresh(id), D)));
    expect(maxLevel(R, almost)).toBe(1);
    const all = pmOf((id) => (core.includes(id) ? onCorrect(fresh(id), D) : fresh(id)));
    expect(maxLevel(R, all)).toBe(2);
  });

  it('переключатель родителей: малыш — только 1, постарше — 2 сразу', () => {
    const all = pmOf((id) => (core.includes(id) ? onCorrect(fresh(id), D) : fresh(id)));
    expect(maxLevel(R, all, 'little')).toBe(1);
    expect(maxLevel(R, pmOf(fresh), 'big')).toBe(2);
  });

  it('детали не мешают этапам: этапы считаются по 13 предметам', () => {
    const heard = pmOf((id) => (core.includes(id) ? { ...fresh(id), heard: 1 } : fresh(id)));
    const st = stageStates(R, heard);
    expect([st.words.done, st.words.total, st.check.unlocked]).toEqual([true, 15, true]);
  });

  it('в «Проверке» детали спрашиваются только после прослушивания', () => {
    const pm = pmOf((id) => (id === 'kitchen.freezer' ? { ...fresh(id), heard: 1 } : fresh(id)));
    expect(checkPool(R, pm, 1)).toEqual(core);
    expect(checkPool(R, pm, 2)).toEqual([...core, 'kitchen.freezer']);
  });
});

describe('вложенные сцены', () => {
  it('цепочка любой глубины', () => {
    expect(sceneChain(R, 'kitchen.fridge.shelf')).toEqual(['kitchen', 'kitchen.fridge.inside', 'kitchen.fridge.shelf']);
    expect(sceneChain(R, 'kitchen.table')).toEqual(['kitchen', 'kitchen.table']);
  });

  it('значок на предмете: какая сцена открывается и с какого уровня', () => {
    expect(openerScene(R, 'kitchen.fridge', 1)).toBeNull();
    expect(openerScene(R, 'kitchen.fridge', 2)).toBe('kitchen.fridge.inside');
    expect(openerScene(R, 'kitchen.shelf', 2)).toBe('kitchen.fridge.shelf');
    expect(childScenes(R, 'kitchen', 1)).toEqual(['kitchen.table']);
    expect(childScenes(R, 'kitchen', 2)).toEqual(['kitchen.table', 'kitchen.fridge.inside']);
  });

  it('в сцене нажимаются только слова открытого уровня', () => {
    expect(wordsInScene(R, 'kitchen.fridge.inside', 1)).toEqual([]);
    expect(wordsInScene(R, 'kitchen.fridge.inside', 2)).toEqual(['kitchen.freezer', 'kitchen.shelf']);
    expect(wordsInScene(R, 'kitchen', 1)).toHaveLength(15); // все нарисованные; у предметов стола зоны есть и в комнате (для наезда)
  });

  it('цикл в сценах — ошибка', () => {
    const bad = { ...R, scenes: { ...R.scenes, a: { image: '', width: 1, height: 1, parent: 'b' }, b: { image: '', width: 1, height: 1, parent: 'a' } } };
    expect(() => sceneChain(bad, 'a')).toThrow(/цикл/);
  });
});
