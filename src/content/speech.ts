// Что и как говорит Mo: строки пакета → сегменты для AudioEngine.
// Фразы этапов берутся целиком; склейка только для ответа на ошибку:
// [Try again.] [This is not] [слово.форма] [This is] [слово.форма]
import type { Segment } from '../audio/engine.ts';
import { checkId, phraseId, type MoLine } from './keys.ts';
import { url, type Content } from './loader.ts';
import type { Line, RoomDef } from './types.ts';

export interface Said extends Segment {
  id: string;
}

export class Speech {
  private asked = new Map<string, number>();
  constructor(private c: Content) {}

  private seg(id: string, line: Line | undefined): Said {
    const has = !!line?.audio && this.c.audio.has(line.audio);
    return { id, text: line?.text ?? '', url: has ? url(`${this.c.pack.audioDir}/${line!.audio}`) : null };
  }

  word(id: string): Said {
    return this.seg(id, this.c.pack.words[id]);
  }
  form(id: string): Said {
    return this.seg(`form.${id}`, this.c.pack.words[id]?.form);
  }
  mo(id: MoLine): Said {
    return this.seg(id, this.c.pack.mo[id]);
  }
  phrase(type: string, wordId: string): Said {
    const id = phraseId(type, wordId);
    return this.seg(id, this.c.pack.phrases[id]);
  }

  /** Вопрос «Проверки»: чередуем «Show me…» и «Where's…» среди записанных (если записан один — он). */
  checkQuestion(room: RoomDef, wordId: string): Said {
    const all = room.checkTypes.map((t) => this.seg(checkId(t, wordId), this.c.pack.phrases[checkId(t, wordId)])).filter((s) => s.text);
    const voiced = all.filter((s) => s.url);
    const pool = voiced.length ? voiced : all;
    const n = this.asked.get(wordId) ?? 0;
    this.asked.set(wordId, n + 1);
    return pool[n % pool.length] ?? { id: wordId, text: '', url: null };
  }

  /** «Try again. This is not a cup. This is a fork.» — target спрашивали, tapped нажали. */
  wrong(target: string, tapped: string): { segs: Said[]; text: string; tappedAt: number } {
    const segs = [this.mo('mo.try_again'), this.mo('mo.this_is_not'), this.form(target), this.mo('mo.this_is'), this.form(tapped)];
    const t = segs.map((s) => s.text);
    return { segs, text: `${t[0]} ${t[1]} ${t[2]}. ${t[3]} ${t[4]}.`, tappedAt: 3 };
  }

  urlsFor(room: RoomDef): (string | null)[] {
    return room.words.flatMap((w) => [this.word(w.id).url, this.form(w.id).url]);
  }
}
