// Прогресс только на устройстве (IndexedDB). Без сервера, аналитики и трекинга.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { WordProgress } from './srs.ts';
import type { Day } from './dates.ts';

export interface DayStat {
  lang: string;
  day: Day;
  activeMs: number;
  answers: number;
  correct: number;
}

/** Доступ по языкам и комнатам. lang/room = '*' — любой. */
export interface Entitlement {
  id: string;
  lang: string;
  room: string;
  source: 'code' | 'link' | 'test';
  grantedAt: number;
}

interface Schema extends DBSchema {
  words: { key: [string, string]; value: WordProgress; indexes: { lang: string } };
  days: { key: [string, string]; value: DayStat; indexes: { lang: string } };
  kv: { key: string; value: unknown };
  entitlements: { key: string; value: Entitlement };
}

export const DB_NAME = 'moneysleep';
let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbp ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('words', { keyPath: ['lang', 'wordId'] }).createIndex('lang', 'lang');
      d.createObjectStore('days', { keyPath: ['lang', 'day'] }).createIndex('lang', 'lang');
      d.createObjectStore('kv');
      d.createObjectStore('entitlements', { keyPath: 'id' });
    },
  });
  return dbp;
}

/** Для тестов: закрыть и забыть соединение. */
export async function resetDbForTests(): Promise<void> {
  if (dbp) (await dbp).close();
  dbp = null;
}

export async function wordsOf(lang: string): Promise<WordProgress[]> {
  return (await db()).getAllFromIndex('words', 'lang', lang);
}
export async function putWord(p: WordProgress): Promise<void> {
  await (await db()).put('words', p);
}
export async function daysOf(lang: string): Promise<DayStat[]> {
  return (await db()).getAllFromIndex('days', 'lang', lang);
}
export async function updateDay(lang: string, day: Day, f: (d: DayStat) => DayStat): Promise<void> {
  const d = await db();
  const tx = d.transaction('days', 'readwrite');
  const cur = (await tx.store.get([lang, day])) ?? { lang, day, activeMs: 0, answers: 0, correct: 0 };
  await tx.store.put(f(cur));
  await tx.done;
}
export async function getKv<T>(key: string, def: T): Promise<T> {
  const v = await (await db()).get('kv', key);
  return v === undefined ? def : (v as T);
}
export async function setKv<T>(key: string, value: T): Promise<void> {
  await (await db()).put('kv', value, key);
}
export async function entitlements(): Promise<Entitlement[]> {
  return (await db()).getAll('entitlements');
}
export async function grant(e: Entitlement): Promise<void> {
  await (await db()).put('entitlements', e);
}
