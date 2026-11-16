// Типы контента. Комнаты (content/rooms/*.json) общие для всех языков,
// пакеты (content/packs/<lang>/pack.json) — только тексты и аудио изучаемого языка.

export type Point = [number, number];
export type Poly = Point[];
export type Rect = [number, number, number, number]; // x, y, w, h в пикселях сцены

export interface SceneDef {
  image: string;
  /** Тот же кадр без предметов-слоёв (для этапа «Фразы»). */
  empty?: string;
  width: number;
  height: number;
  /** Крупный план: из какой сцены и из какого прямоугольника на неё «наезжаем». */
  parent?: string;
  zoomFrom?: Rect;
}

export interface SpriteDef {
  scene: string;
  image: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WordDef {
  /** Постоянный id слова, например kitchen.fridge. Он же имя аудиофайла. */
  id: string;
  /** Основная сцена слова (там его спрашивают в «Проверке»). */
  scene: string;
  /** Зоны нажатия по сценам (полигоны в пикселях сцены). */
  zones: Record<string, Poly>;
  /** Виды фраз этапа «Фразы», например ["i_want"]. */
  phrases?: string[];
  /** Отдельный слой предмета (для полёта к Mo). */
  sprite?: SpriteDef;
}

export interface RoomDef {
  id: string;
  order: number;
  /** Иконка комнаты для отчёта родителям. */
  icon: string;
  start: string;
  scenes: Record<string, SceneDef>;
  /** Виды вопросов этапа «Проверка», например ["show_me", "where"]. */
  checkTypes: string[];
  words: WordDef[];
  stages: { phrases: { scene: string; choices: number } };
}

export interface Line {
  text: string;
  /** Имя файла в audioDir (mp3 или m4a). Пусто — ещё не озвучено. */
  audio: string;
}

export interface PackWord extends Line {
  /** Форма для рамки «это …»: EN «a cup», DE «die Tasse», ES «la taza». */
  form: Line;
}

export interface Pack {
  lang: string;
  version: number;
  audioDir: string;
  /** Слово всегда пишется с артиклем (de-DE, es-419). Проверяет валидатор. */
  articles: string[];
  words: Record<string, PackWord>;
  /** Целые фразы этапов «Проверка» и «Фразы»: check.<вид>.<id>, phrase.<вид>.<id>. */
  phrases: Record<string, Line>;
  /** Реплики Mo и куски ответа на ошибку. */
  mo: Record<string, Line>;
}

export interface LanguageDef {
  lang: string;
  /** Код флажка для выбора языка без слов. */
  flag: string;
}

export interface FreeRule {
  lang: string; // '*' = любой
  room: string; // '*' = любая
}

export interface Catalog {
  defaultLang: string;
  languages: LanguageDef[];
  rooms: string[];
  /** Сколько слов обещано всего (для отчёта «47 / 130»). */
  plannedWords: number;
  /** Что открыто без покупки. */
  free: FreeRule[];
}
