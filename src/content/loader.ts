// Загрузчик контента: каталог, комнаты и пакет выбранного языка.
// Новый язык = новая папка content/packs/<lang>/ + assets/audio/<lang>/, код не меняется.
import type { Catalog, Pack, RoomDef } from './types.ts';

export const url = (path: string): string => import.meta.env.BASE_URL + path.replace(/^\//, '');

async function json<T>(path: string): Promise<T> {
  const r = await fetch(url(path));
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return (await r.json()) as T;
}

export interface Content {
  catalog: Catalog;
  rooms: RoomDef[];
  pack: Pack;
  /** Какие аудиофайлы пакета реально есть (генерируется при сборке). */
  audio: Set<string>;
}

export async function loadCatalog(): Promise<Catalog> {
  return json<Catalog>('content/catalog.json');
}

export async function loadContent(catalog: Catalog, lang: string): Promise<Content> {
  const [rooms, pack, audio] = await Promise.all([
    Promise.all(catalog.rooms.map((id) => json<RoomDef>(`content/rooms/${id}.json`))),
    json<Pack>(`content/packs/${lang}/pack.json`),
    json<string[]>(`content/packs/${lang}/audio-index.json`).catch(() => [] as string[]),
  ]);
  return { catalog, rooms, pack, audio: new Set(audio) };
}

/** Попросить service worker сохранить пакет языка для офлайна. */
export async function cachePackOffline(c: Content): Promise<void> {
  const files = [
    url(`content/packs/${c.pack.lang}/pack.json`),
    url(`content/packs/${c.pack.lang}/audio-index.json`),
    ...[...c.audio].map((f) => url(`${c.pack.audioDir}/${f}`)),
  ];
  const reg = await navigator.serviceWorker?.ready;
  reg?.active?.postMessage({ type: 'cache-pack', lang: c.pack.lang, version: c.pack.version, files });
}
