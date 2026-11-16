// Прогресс ребёнка по изучаемому языку: кэш в памяти + запись в IndexedDB.
import type { RoomDef } from '../content/types.ts';
import { dayOf } from './dates.ts';
import { getKv, putWord, setKv, updateDay, wordsOf } from './db.ts';
import { emptyProgress, onCorrect, onWrong, type WordProgress } from './srs.ts';
import { stageStates, type ProgressMap } from './stages.ts';

export class Progress {
  private constructor(
    readonly lang: string,
    readonly pm: ProgressMap,
    public coins: number,
    private now: () => number,
  ) {}

  static async load(lang: string, now: () => number = Date.now): Promise<Progress> {
    const words = await wordsOf(lang);
    return new Progress(lang, new Map(words.map((w) => [w.wordId, w])), await getKv('coins', 0), now);
  }

  get today() {
    return dayOf(this.now());
  }

  get(room: RoomDef, wordId: string): WordProgress {
    return this.pm.get(wordId) ?? emptyProgress(this.lang, room.id, wordId);
  }

  stages(room: RoomDef) {
    return stageStates(room, this.pm);
  }

  private async save(p: WordProgress) {
    this.pm.set(p.wordId, p);
    await putWord(p);
  }

  async heard(room: RoomDef, wordId: string) {
    const p = this.get(room, wordId);
    await this.save({ ...p, heard: p.heard + 1 });
    await this.markActive();
  }

  async asked(room: RoomDef, wordId: string) {
    await this.save({ ...this.get(room, wordId), lastAsked: this.now() });
  }

  /** Ответ в «Проверке». Возвращает true, если слово выучено только что. */
  async answer(room: RoomDef, wordId: string, correct: boolean): Promise<boolean> {
    const p = this.get(room, wordId);
    const q = correct ? onCorrect(p, this.today) : onWrong(p, this.today);
    await this.save(q);
    await updateDay(this.lang, this.today, (d) => ({ ...d, answers: d.answers + 1, correct: d.correct + (correct ? 1 : 0) }));
    return !p.learnedDay && !!q.learnedDay;
  }

  async phraseDone(room: RoomDef, wordId: string) {
    const p = this.get(room, wordId);
    await this.save({ ...p, phraseCorrect: p.phraseCorrect + 1 });
  }

  async addCoin(n = 1) {
    this.coins += n;
    await setKv('coins', this.coins);
  }

  async addActiveTime(ms: number) {
    await updateDay(this.lang, this.today, (d) => ({ ...d, activeMs: d.activeMs + ms }));
  }

  private async markActive() {
    await updateDay(this.lang, this.today, (d) => d);
  }
}
