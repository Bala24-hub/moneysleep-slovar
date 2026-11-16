// Доступ по языкам: работает и «каждый язык отдельно», и «все сразу».
// Покупка (Digistore24, код или ссылка) — позже; пока открыто только то, что в catalog.free.
import type { FreeRule } from './types.ts';

export interface Grant {
  lang: string;
  room: string;
}

const match = (rule: string, v: string) => rule === '*' || rule === v;

export function hasAccess(free: FreeRule[], grants: Grant[], lang: string, room: string): boolean {
  return [...free, ...grants].some((g) => match(g.lang, lang) && match(g.room, room));
}
