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

describe('es-419 по таблице Герхарда', () => {
  it('все тексты есть, артикли слова (el/la) и формы (un/una) верные', () => {
    const r = validateLang('es-419');
    expect(r.errors.filter((e) => e.what !== 'audio')).toEqual([]);
  });
});
