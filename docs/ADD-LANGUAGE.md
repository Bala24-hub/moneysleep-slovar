# Как добавить новый язык

Новый язык — это новые данные (тексты и озвучка), код не меняется.
Картинки, сцены и зоны нажатия общие для всех языков (`content/rooms/*.json`).

## Шаги

1. **Создать пакет.** В корне проекта:

   ```bash
   node scripts/scaffold-pack.ts it-IT --articles il,lo,la,i,gli,le
   ```

   Появятся `content/packs/it-IT/pack.json` (все записи с пустым текстом) и папка `assets/audio/it-IT/`.
   `--articles` — артикли, с которыми **обязательно** пишется каждое слово (для языков с артиклями).
   Без `--articles` (как у английского) артикль не проверяется.

2. **Заполнить тексты** в `pack.json` (формат ниже).

3. **Положить озвучку** в `assets/audio/<lang>/`. Имя файла = id записи + `.mp3` (или `.m4a`).
   Только mp3 или m4a: iPad Safari не играет ogg/opus.

4. **Добавить язык в каталог** `content/catalog.json` → `languages`: `{ "lang": "it-IT", "flag": "it" }`.

5. **Проверить:**

   ```bash
   npm run validate -- it-IT
   ```

   Валидатор перечислит всё, чего не хватает: нет текста, нет аудиофайла, слово без артикля.
   Код выхода 0 — пакет готов.

Когда в комнаты добавляются новые слова, снова запустите `scaffold-pack.ts` для каждого языка: он допишет недостающие записи и не тронет готовые тексты.

## Формат `pack.json`

```jsonc
{
  "lang": "de-DE",
  "version": 1,                         // увеличить, чтобы у пользователей обновился офлайн-кэш пакета
  "audioDir": "assets/audio/de-DE",
  "articles": ["der", "die", "das"],    // слово и форма «это …» обязаны начинаться с одного из них
  "words": {
    "kitchen.cup": {
      "text": "die Tasse",                                     // подпись на картинке и в пузыре Mo
      "audio": "kitchen.cup.mp3",                              // Mo говорит слово (этап «Слова»)
      "form": { "text": "die Tasse", "audio": "form.kitchen.cup.mp3" }  // для «Das ist …» в ответе на ошибку
    }
  },
  "phrases": {                          // фразы этапов ЦЕЛИКОМ, со своим аудио (падежи!)
    "check.show_me.kitchen.chair": { "text": "Zeig mir den Stuhl!", "audio": "check.show_me.kitchen.chair.mp3" },
    "check.where.kitchen.chair":   { "text": "Wo ist der Stuhl?",   "audio": "check.where.kitchen.chair.mp3" },
    "phrase.i_want.kitchen.cup":   { "text": "Ich möchte die Tasse!", "audio": "phrase.i_want.kitchen.cup.mp3" }
  },
  "mo": {                               // реплики Mo
    "mo.learn_english_with_me": { "text": "Lern Deutsch mit mir!", "audio": "mo.learn_english_with_me.mp3" },
    "mo.thank_you":  { "text": "Danke!", "audio": "mo.thank_you.mp3" },
    "mo.try_again":  { "text": "Versuch es noch mal.", "audio": "mo.try_again.mp3" },
    "mo.this_is_not": { "text": "Das ist nicht", "audio": "mo.this_is_not.mp3" },
    "mo.this_is":    { "text": "Das ist", "audio": "mo.this_is.mp3" }
  }
}
```

### Какие записи нужны

| id | что это | этап |
|---|---|---|
| `<комната>.<слово>` | слово | «Слова» |
| `form.<комната>.<слово>` | форма для «это …» (EN *a cup*, DE *die Tasse*, ES *la taza*) | ответ на ошибку |
| `check.show_me.<id>` | «Show me the X!» | «Проверка» |
| `check.where.<id>` | «Where's the X?» | «Проверка» |
| `phrase.i_want.<id>` | «I want the X!» (только предметы стола) | «Фразы» |
| `mo.*` | реплики Mo | везде |

- В «Проверке» достаточно одного из двух вопросов на слово. Если записаны оба, Mo их чередует. Валидатор считает второй вопрос желательным, но не обязательным.
- Склеивать фразы из кусков нельзя. Исключение — ответ на ошибку:
  `[mo.try_again] [mo.this_is_not] [form.<что спросили>] [mo.this_is] [form.<что нажали>]`.
- `mo.learn_english_with_me` — это id приветствия, а не текст. В каждом языке там своё приветствие («Lern Deutsch mit mir!», «¡Aprende español conmigo!»).

## Доступ к языкам

Что открыто бесплатно, задаёт `content/catalog.json` → `free` (сейчас кухня на любом языке).
Покупки хранятся на устройстве как права `{ lang, room }`, где `*` означает «любой».
Так работают оба варианта продажи: каждый язык отдельно (`{ "lang": "de-DE", "room": "*" }`) и все сразу (`{ "lang": "*", "room": "*" }`).
