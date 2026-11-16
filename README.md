# Moneysleep «Живой словарь»

PWA для iPad и iPhone: словарь в картинках для детей от 3 лет с персонажем Mo. Задачи — `docs/tickets/`, правила — `CLAUDE.md`.

## Запуск

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # логика: повторение 1·3·7, этапы, отчёт, IndexedDB
npm run validate     # пропуски в языковых пакетах
npm run build        # dist/ для Vercel (service worker собирается сам)
```

## Устройство

| Где | Что |
|---|---|
| `content/catalog.json` | языки (флажки), комнаты, что открыто бесплатно, сколько слов обещано |
| `content/rooms/<комната>.json` | сцены, слова, зоны нажатия — общие для всех языков |
| `content/packs/<lang>/pack.json` | тексты изучаемого языка → `docs/ADD-LANGUAGE.md` |
| `assets/audio/<lang>/<id>.mp3` | озвучка (имя файла = id) |
| `assets/scenes/` | оригиналы художника; `assets/scenes/app/` — подготовленные для приложения (`python3 tools/prepare_scenes.py`) |
| `src/progress/` | прогресс только на устройстве (IndexedDB), повторение 1·3·7, открытие этапов, данные отчёта |
| `src/screens/room.ts` | три этапа комнаты: Слова → Проверка → Фразы |
| `sw/sw.js` | офлайн: приложение при установке, пакет выбранного языка — по запросу |
| `docs/screenshots/` | скриншоты на согласование (`npm run screenshots` при запущенном `npm run dev`) |

Без сервера для данных ребёнка, без аналитики и трекинга. ElevenLabs из кода не вызывается.
