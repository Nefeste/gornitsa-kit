# Как перевести игру на набор

Порядок:
1. Владелец сливает набор и ставит теги `v1.0.0` и `v1`.
2. Агент открывает PR в игре. Файлы `.github/` — пути владельца, такой PR сливает владелец.
3. После слияния — один пробный запуск. Если не прошёл, откат — возврат прежнего файла.

Переводить по одной игре. Первой — «Сени» (там только автослияние) или «Анамнез».

## Что заменяется

| Было в игре | Станет |
|---|---|
| `.github/workflows/rustore.yml` (~60 строк) и `tools/store/rustore.mjs` (~95 строк) | `.github/workflows/rustore.yml` на 25 строк с `uses: Nefeste/gornitsa-kit/.github/workflows/rustore.yml@v1`; `tools/store/rustore.mjs` удаляется (ссылки на него в `docs/05-process.md` — на набор) |
| `.github/workflows/automerge.yml` (55–165 строк) и `.github/scripts/owned.mjs` / `owner-paths.ts` / `automerge.ts` | `.github/workflows/automerge.yml` на 30 строк с `uses: …/automerge.yml@v1`; скрипт удаляется |
| в `android.yml`: шаги ключа, подписи и содержимого (~100 строк) | три шага `uses: Nefeste/gornitsa-kit/actions/android-…@v1`; белый список разрешений — файлом `.github/apk-permissions.txt` |

Сборка, проверки, переменные магазина (`EXPO_PUBLIC_…`) и выпуск в `android.yml` остаются у игры.

## Параметры по играм

Взяты из нынешних файлов игр (30.10.2026). Сверять перед PR: игры меняются.

| Игра | `package` | `apk` | автослияние: `workflows` / `check` | `dispatch` | `gradle-prefix` |
|---|---|---|---|---|---|
| «Вотчина» | `com.votchina.game` | `votchina-*.apk` | `PR` / `Типы, линтер, тесты` | `server.yml worker.yml`, пути `^(src/\|App\.tsx$\|app\.config\.js$\|package(-lock)?\.json$\|tools/e2e/server\.ts$)` | `VOTCHINA` |
| «Нарды» | `games.gornitsa.nardy` | `nardy-*.apk` | `Проверки PR` / `Типы, линтер, тесты` | — (пути сервера — пути владельца) | `NARDY` |
| «Сказы» | `games.gornitsa.skazy` | `skazy-*.apk` | `PR` / `Проверки PR` | `server.yml`, пути — `paths` его `server.yml` | `SKAZY` |
| «Анамнез» | `games.gornitsa.anamnez` | `anamnez-*.apk` | `PR` / `Проверки PR` | — | `ANAMNEZ` |
| «Узоры» | `games.gornitsa.uzory` | `uzory-*.apk` | `PR` / `Типы, линтер и тесты` | — | `UZORY` |
| «Сени» | — | — | `CI` / `Тесты и типы` | — (машина сама забирает `main`) | — |

**Содержимое APK** (`android-contents`):

| Игра | `allow-file` (что в нём) | `forbid` | `require` | `backup` | `min-target-sdk` | прочее |
|---|---|---|---|---|---|---|
| «Вотчина» | INTERNET, VIBRATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, ACCESS_NETWORK_STATE, FOREGROUND_SERVICE, `com.votchina.game.*` | — | `INTERNET` | `off` | — | у неё ещё свои проверки бандла («Поддержать», почта) — остаются шагом игры |
| «Нарды» | `.github/apk-permissions.txt` уже есть | — | `INTERNET` | `off` | — | — |
| «Сказы» | INTERNET, ACCESS_NETWORK_STATE, VIBRATE, MODIFY_AUDIO_SETTINGS, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, `games.gornitsa.skazy.*` | `FOREGROUND_SERVICE\|INSTALL_REFERRER\|WAKE_LOCK` | `INTERNET` | `off` | 36 | `only-arm64: true` |
| «Анамнез» | VIBRATE, MODIFY_AUDIO_SETTINGS, `games.gornitsa.anamnez.*` | `INTERNET\|NETWORK_STATE\|FOREGROUND_SERVICE\|INSTALL_REFERRER` | — | `off` | 36 | `only-arm64: true`, `max-size-mb: 100` |
| «Узоры» | INTERNET, ACCESS_NETWORK_STATE, VIBRATE, MODIFY_AUDIO_SETTINGS, `games.gornitsa.uzory.*` | `READ_MEDIA\|FOREGROUND_SERVICE\|INSTALL_REFERRER\|WAKE_LOCK` | `INTERNET` | **`on`** (автобэкап работ, ADR игры) | 36 | `max-size-mb: 90` |

Номер приложения RuStore в манифесте («Узоры» сверяют его по `console_app_id_value`) и проверки
бандла «Вотчины» остаются шагами игр: они не общие.

## Чем отличается от копий

- **Автослияние «Анамнеза» и «Узоров»** станет как у «Вотчины» и «Сеней». Метка одобряет коммит
  (комментарий бота с хешем), а слить можно только его (`--match-head-commit`). Сейчас у них
  метку снимает новый коммит, но сам коммит не закреплён.
- **Загрузка в RuStore** проверяет, что в выпуске ровно один APK по шаблону, а имя пакета похоже
  на идентификатор. По умолчанию берёт последний выпуск без черновиков и пре-релизов
  (`prereleases: true` — с ними).
- **После слияния** автослияние ждёт до минуты, пока GitHub сольёт PR, и только потом запускает
  `dispatch` (так делают «Сказы»).
