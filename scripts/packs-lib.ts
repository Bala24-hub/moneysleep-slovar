// Общие функции для скриптов пакетов (Node 22+, запускается как .ts без сборки).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, Pack, RoomDef } from '../src/content/types.ts';

export const ROOT = join(import.meta.dirname, '..');
export const readJson = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), 'utf8')) as T;
export const loadCatalog = (): Catalog => readJson<Catalog>('content/catalog.json');
export const loadRooms = (cat: Catalog): RoomDef[] => cat.rooms.map((id) => readJson<RoomDef>(`content/rooms/${id}.json`));
export const packPath = (lang: string): string => `content/packs/${lang}/pack.json`;
export const loadPack = (lang: string): Pack | null =>
  existsSync(join(ROOT, packPath(lang))) ? readJson<Pack>(packPath(lang)) : null;
export const audioExists = (pack: Pack, file: string): boolean =>
  !!file && /\.(mp3|m4a)$/i.test(file) && existsSync(join(ROOT, pack.audioDir, file));
