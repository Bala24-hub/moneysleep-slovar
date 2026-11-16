import { describe, expect, it } from 'vitest';
import en from '../content/packs/en-US/pack.json';
import es from '../content/packs/es-419/pack.json';
import room from '../content/rooms/kitchen.json';
import { Speech } from '../src/content/speech.ts';
import type { Catalog, Pack, RoomDef } from '../src/content/types.ts';

const R = room as unknown as RoomDef;
const speech = (pack: unknown, audio: string[] = []) =>
  new Speech({ catalog: {} as Catalog, rooms: [R], pack: pack as Pack, audio: new Set(audio) });

describe('ответ на ошибку (единственная разрешённая склейка)', () => {
  it('EN', () => {
    expect(speech(en).wrong('kitchen.cup', 'kitchen.fork').text).toBe('Try again. This is not a cup. This is a fork.');
  });
  it('ES — форма с неопределённым артиклем', () => {
    expect(speech(es).wrong('kitchen.cup', 'kitchen.fork').text).toBe('Inténtalo otra vez. Esto no es una taza. Esto es un tenedor.');
  });
  it('сегменты: try_again, this_is_not, форма спрошенного, this_is, форма нажатого', () => {
    expect(speech(en).wrong('kitchen.cup', 'kitchen.fork').segs.map((s) => s.id)).toEqual([
      'mo.try_again', 'mo.this_is_not', 'form.kitchen.cup', 'mo.this_is', 'form.kitchen.fork',
    ]);
  });
});

describe('вопрос «Проверки»', () => {
  it('если записан один вид — только он; если оба — чередуются', () => {
    const one = speech(en, ['check.show_me.kitchen.chair.mp3']);
    expect([1, 2, 3].map(() => one.checkQuestion(R, 'kitchen.chair').id)).toEqual(Array(3).fill('check.show_me.kitchen.chair'));
    const both = speech(es, ['check.show_me.kitchen.chair.mp3', 'check.where.kitchen.chair.mp3']);
    expect([1, 2].map(() => both.checkQuestion(R, 'kitchen.chair').text)).toEqual(['¡Muéstrame la silla!', '¿Dónde está la silla?']);
  });
});
