// Какие записи должны быть в языковом пакете. Чистые функции без зависимостей:
// используются и приложением, и валидатором (node scripts/validate-packs.ts).

export interface RoomLike {
  checkTypes: string[];
  words: { id: string; phrases?: string[] }[];
}

/** Реплики Mo, общие для всех комнат. Ответ на ошибку склеивается из try_again / this_is_not / this_is. */
export const MO_LINES = [
  'mo.learn_english_with_me',
  'mo.thank_you',
  'mo.try_again',
  'mo.this_is_not',
  'mo.this_is',
] as const;
export type MoLine = (typeof MO_LINES)[number];

export const checkId = (type: string, wordId: string): string => `check.${type}.${wordId}`;
export const phraseId = (type: string, wordId: string): string => `phrase.${type}.${wordId}`;
/** Имя аудио формы «это …» (a cup / die Tasse / la taza). */
export const formId = (wordId: string): string => `form.${wordId}`;

export interface ExpectedPhrase {
  id: string;
  wordId: string;
  /** Группа взаимозаменяемых фраз: достаточно одной из группы (вопросы «Проверки»). */
  group: string;
}

export interface Expected {
  words: string[];
  phrases: ExpectedPhrase[];
  mo: string[];
}

export function expectedEntries(rooms: RoomLike[]): Expected {
  const words: string[] = [];
  const phrases: ExpectedPhrase[] = [];
  for (const room of rooms) {
    for (const w of room.words) {
      words.push(w.id);
      for (const t of room.checkTypes) phrases.push({ id: checkId(t, w.id), wordId: w.id, group: `check:${w.id}` });
      for (const t of w.phrases ?? []) phrases.push({ id: phraseId(t, w.id), wordId: w.id, group: `phrase:${t}:${w.id}` });
    }
  }
  return { words, phrases, mo: [...MO_LINES] };
}
