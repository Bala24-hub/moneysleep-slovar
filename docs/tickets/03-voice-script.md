БИЛЕТ 3: озвучка скриптом + тексты кухни en-US и es-419

Решения Герхарда (16.11.2026)
- Голос Mo, voice_id VZecfgmpcTkkHNOiQKWr, модель eleven_multilingual_v2 — для всех языков. Испанский тест одобрен.
- Приложение ElevenLabs по-прежнему не вызывает. Исключение — офлайн-скрипт tools/voice/ только для генерации ассетов.
- Ключ — «Сетевой секрет» среды Default: хост api.elevenlabs.io, путь /v1/text-to-speech/, заголовок xi-api-key. Прокси подставляет ключ сам: в коде, .env, логах и коммитах ключа нет, запросы идут без заголовка ключа. Домен api.elevenlabs.io — в «Доступ к сети».

Скрипт (npm run voice)
- Берёт из content/packs/<lang>/pack.json все записи без файла assets/audio/<lang>/<id>.mp3.
- По умолчанию сухой прогон: список недостающих строк, число знаков, оценка кредитов (1 знак = 1 кредит). Ничего не тратит.
- Генерация только с --yes; стоп, если знаков больше --max-chars (по умолчанию 2500).
- Существующие файлы не перезаписывать (перезапись только с --force и списком id).
- POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}, model_id eleven_multilingual_v2, output_format mp3_44100_128, один дубль на строку, настройки голоса по умолчанию.
- После генерации: обрезать тишину по краям (оставить ~80 мс), выровнять громкость (ffmpeg loudnorm, около −16 LUFS).
- Прослушка для Герхарда: docs/audio-preview/<lang>-kitchen.mp3 — все новые строки подряд, пауза 0,7 с, в порядке pack.json.
- В конце — валидатор.

Тексты кухни
EN слово | EN форма «это …» | ES слово | ES форма
fridge | a fridge | el refrigerador | un refrigerador
frying pan | a frying pan | la sartén | una sartén
kitchen towel | a kitchen towel | la toalla de cocina | una toalla de cocina
chair | a chair | la silla | una silla
table | a table | la mesa | una mesa
cup | a cup | la taza | una taza
plate | a plate | el plato | un plato
spoon | a spoon | la cuchara | una cuchara
fork | a fork | el tenedor | un tenedor
bowl | a bowl | el tazón | un tazón

Фразы ES (артикль как у слова)
Show me the X! → ¡Muéstrame la silla!
Where's the X? → ¿Dónde está la silla?
I want the X! → ¡Quiero la taza! (те же 5 предметов стола, что в en-US)
Thank you! → ¡Gracias!
Try again. → Inténtalo otra vez.
This is not → Esto no es
This is → Esto es
Learn English with me! → ¡Aprende español conmigo!

Поправка к билету 02: в испанском форма «это …» — с неопределённым артиклем («Esto no es una taza. Esto es un tenedor.»). Сковородка только la sartén.

Порядок
a) скрипт + тексты en-US и es-419;
b) сухой прогон — список и число знаков в чат;
c) когда секрет появится — проверить одним словом. До 2500 знаков — генерировать кухню en-US и es-419 без дополнительного подтверждения, больше — ждать. Если сеть или секрет не работают — не обходить, написать, что нужно;
d) коммит, пуш; отчёт: сколько файлов, сколько знаков ушло, где прослушки.
