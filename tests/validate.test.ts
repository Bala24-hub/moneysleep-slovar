import { describe, expect, it } from 'vitest';
import { validateLang } from '../scripts/validate-packs.ts';

describe('валидатор пакетов', () => {
  it('en-US: все тексты есть, недостающее аудио перечислено', () => {
    const r = validateLang('en-US');
    expect(r.errors.filter((e) => e.what === 'text')).toEqual([]);
    const noAudio = r.errors.filter((e) => e.what === 'audio').map((e) => e.id);
    expect(noAudio).toContain('mo.try_again');
    expect(noAudio).toContain('form.kitchen.cup');
    expect(noAudio).not.toContain('kitchen.fridge'); // файл есть
    // у стула есть «Show me…», «Where's…» — только желательный
    expect(noAudio).not.toContain('check.where.kitchen.chair');
    expect(r.warnings.map((w) => w.id)).toContain('check.where.kitchen.chair');
  });

  it('пустой de-DE: нет ни текстов, ни аудио', () => {
    const r = validateLang('de-DE');
    expect(r.complete).toBe(0);
    expect(r.errors.some((e) => e.what === 'text' && e.id === 'kitchen.cup')).toBe(true);
  });

  it('неизвестный язык — ошибка «нет пакета»', () => {
    expect(validateLang('xx-XX').errors[0].what).toBe('pack');
  });
});

describe('es-419 по таблице Герхарда (кухня; действия, матрица и ванная — позже)', () => {
  it('слова, формы и вопросы есть, артикли слова (el/la) и формы (un/una) верные', () => {
    const r = validateLang('es-419');
    // испанские фразы-действия и новые реплики Mo Герхард пришлёт отдельно
    const pending = (id: string) =>
      id.startsWith('action.') || id.startsWith('matrix.') || id.includes('bathroom.') || id === 'mo.whats_next' || id === 'mo.now_you_tell_mo';
    expect(r.errors.filter((e) => e.what !== 'audio' && !pending(e.id))).toEqual([]);
    expect(r.errors.filter((e) => e.what === 'text').map((e) => e.id)).toContain('action.kitchen.open_fridge');
  });
});

describe('структура комнат', () => {
  it('действия, состояния, пары и цепочка кухни согласованы', async () => {
    const { validateRooms } = await import('../scripts/validate-packs.ts');
    expect(validateRooms()).toEqual([]);
  });
});

describe('текст-матрица', () => {
  it('en-US: все предложения и целиком есть, слова кухни встречаются в своих предложениях', () => {
    const r = validateLang('en-US');
    expect(r.errors.filter((e) => e.id.startsWith('matrix.') && e.what !== 'audio')).toEqual([]);
    expect(r.errors.map((e) => e.id)).toContain('matrix.kitchen.full'); // аудио целиком ещё нет
  });
});
