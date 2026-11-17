// Уровни и вложенные сцены (решение Герхарда 16.11.2026).
// Уровень 1 — предметы (13 в комнате), уровень 2 — детали предметов («130+ слов»).
// Уровень 2 открывается по успехам: все предметы уровня 1 в комнате выучены → на предмете с деталями значок.
// Родители могут переключить «малыш / постарше» (картинкой, без слов).
import type { Level, RoomDef, WordDef } from '../content/types.ts';
import { isLearned, type WordProgress } from './srs.ts';

/** auto — по успехам; little — только уровень 1; big — детали открыты сразу. */
export type LevelMode = 'auto' | 'little' | 'big';

export const levelOf = (w: Pick<WordDef, 'level'>): Level => w.level ?? 1;

/** Слово уже есть на картинке (есть зона нажатия). Слова без зон — запись в пакете заведена, картинку ждём. */
export const isPlaced = (w: Pick<WordDef, 'zones'>): boolean => Object.keys(w.zones ?? {}).length > 0;

/** Предметы уровня 1, которые уже нарисованы: по ним открываются этапы и считается «N/N» комнаты. */
export function coreWords(room: RoomDef): WordDef[] {
  return room.words.filter((w) => levelOf(w) === 1 && isPlaced(w));
}

/** До какого уровня открыта комната. */
export function maxLevel(room: RoomDef, pm: Map<string, WordProgress>, mode: LevelMode = 'auto'): Level {
  if (mode === 'little') return 1;
  if (mode === 'big') return 2;
  return coreWords(room).every((w) => isLearned(pm.get(w.id))) ? 2 : 1;
}

/** Цепочка сцен от корня комнаты до sceneId включительно. */
export function sceneChain(room: RoomDef, sceneId: string): string[] {
  const out: string[] = [];
  for (let id: string | undefined = sceneId; id; id = room.scenes[id]?.parent) {
    if (out.includes(id)) throw new Error(`цикл сцен: ${id}`);
    out.unshift(id);
  }
  return out;
}

/** Сцены приближения, которые открываются с этой сцены на данном уровне. */
export function childScenes(room: RoomDef, sceneId: string, level: Level): string[] {
  return Object.entries(room.scenes)
    .filter(([, s]) => s.parent === sceneId && (s.level ?? 1) <= level)
    .map(([id]) => id);
}

/** Сцена деталей, которую открывает предмет (значок на предмете), или null. */
export function openerScene(room: RoomDef, wordId: string, level: Level): string | null {
  const hit = Object.entries(room.scenes).find(([, s]) => s.opener === wordId && (s.level ?? 1) <= level);
  return hit ? hit[0] : null;
}

/** Какие слова можно нажимать в сцене на данном уровне. */
export function wordsInScene(room: RoomDef, sceneId: string, level: Level): string[] {
  return room.words.filter((w) => w.zones[sceneId] && levelOf(w) <= level).map((w) => w.id);
}

/**
 * Кого можно спрашивать в «Проверке»: все предметы уровня 1,
 * детали — только открытые и уже прослушанные (сначала услышал, потом спрашивают).
 */
export function checkPool(room: RoomDef, pm: Map<string, WordProgress>, level: Level): string[] {
  return room.words
    .filter((w) => isPlaced(w) && (levelOf(w) === 1 || (levelOf(w) <= level && (pm.get(w.id)?.heard ?? 0) > 0)))
    .map((w) => w.id);
}
