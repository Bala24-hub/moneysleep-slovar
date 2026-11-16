// Только для разработки и скриншотов (в сборку не попадает): window.__ms.
import type { App } from './app.ts';
import { RoomScreen } from './screens/room.ts';
import { HomeScreen } from './screens/home.ts';
import type { StageId } from './progress/stages.ts';

export function install(app: App) {
  const room = () => app.content.rooms[0];
  let cur: RoomScreen | null = null;
  (window as unknown as { __ms: unknown }).__ms = {
    app,
    /** Все слова прослушаны (открыта «Проверка»). */
    async heardAll() {
      for (const w of room().words) if (!app.progress.get(room(), w.id).heard) await app.progress.heard(room(), w.id);
    },
    /** Все слова выучены (открыты «Фразы»). */
    async learnAll() {
      for (const w of room().words) if (!app.progress.get(room(), w.id).learnedDay) await app.progress.answer(room(), w.id, true);
    },
    room(stage?: StageId) {
      app.audio.unlock();
      cur = new RoomScreen(app, room(), stage);
      app.show(cur);
    },
    /** Следующий вопрос/фраза будет про этот предмет. */
    next(id: string) {
      RoomScreen.devNextTarget = id;
    },
    rect(id: string) {
      const r = cur?.devRect(id);
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null;
    },
    state() {
      return cur?.devState ?? null;
    },
    home() {
      app.show(new HomeScreen(app));
    },
  };
}
