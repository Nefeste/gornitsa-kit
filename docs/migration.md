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
| «Вотчина» | `com.votchina.game` (`prereleases: true`) | `votchina-*.apk` | `PR` / `Типы, линтер, тесты` | `server.yml worker.yml`, пути `^(src/\|App\.tsx$\|app\.config\.js$\|package(-lock)?\.json$\|tools/e2e/server\.ts$)` | `VOTCHINA` |
| «Нарды» | `games.gornitsa.nardy` (`prereleases: true`) | `nardy-*.apk` | `Проверки PR` / `Типы, линтер, тесты` | — (сервер выкладывают руками; нужен ли `dispatch` — решение владельца) | `NARDY` |
| «Сказы» | `games.gornitsa.skazy` | `skazy-*.apk` | `PR` / `Проверки PR` | `server.yml`, пути `^(server/\|src/engine/\|src/content/\|src/state/protocol\.ts$\|content/\|tools/content/\|package-lock\.json$\|\.github/workflows/server\.yml$)` | `SKAZY` |
| «Анамнез» | `games.gornitsa.anamnez` | `anamnez-*.apk` | `PR` / `Проверки PR` | — | `ANAMNEZ` |
| «Узоры» | `games.gornitsa.uzory` (`prereleases: true`) | `uzory-*.apk` | `PR` / `Типы, линтер и тесты` | — | `UZORY` |
| «Сени» | — | — | `CI` / `Тесты и типы` | — (машина сама забирает `main`) | — |

**Содержимое APK** (`android-contents`):

| Игра | `allow-file` (что в нём) | `forbid` | `require` | `backup` | `min-target-sdk` | прочее |
|---|---|---|---|---|---|---|
| «Вотчина» | INTERNET, VIBRATE, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, ACCESS_NETWORK_STATE, FOREGROUND_SERVICE, `com.votchina.game.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | — | — (игра не проверяла) | `off` | — | у неё ещё свои проверки бандла («Поддержать», почта) — остаются шагом игры |
| «Нарды» | `.github/apk-permissions.txt` уже есть (с `com.google.android.gms.permission.AD_ID` для рекламы Яндекса) | — | `^android\.permission\.INTERNET$` | **`any`** (с 1.1.2 `allowBackup: true`, ADR игры 0024) | — | `deny` — список студии **без `AD_ID`**; `align-16k: false` (игра не проверяла) |
| «Сказы» | INTERNET, ACCESS_NETWORK_STATE, VIBRATE, MODIFY_AUDIO_SETTINGS, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, `games.gornitsa.skazy.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `FOREGROUND_SERVICE\|INSTALL_REFERRER\|WAKE_LOCK` | — (игра не проверяла) | `off` | 36 | `only-arm64: true` |
| «Анамнез» | VIBRATE, MODIFY_AUDIO_SETTINGS, `games.gornitsa.anamnez.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `INTERNET\|NETWORK_STATE\|FOREGROUND_SERVICE\|INSTALL_REFERRER` | — | **`any`** (игра не проверяла; `allowBackup` в `app.json` не задан — значит, включён) | 36 | `only-arm64: true`, `max-size-mb: 100` |
| «Узоры» | INTERNET, ACCESS_NETWORK_STATE, VIBRATE, MODIFY_AUDIO_SETTINGS, `games.gornitsa.uzory.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | `READ_MEDIA\|FOREGROUND_SERVICE\|INSTALL_REFERRER\|WAKE_LOCK` | — (игра не проверяла) | **`on`** (автобэкап работ, ADR игры) | — (игра только печатала) | `max-size-mb: 90`; ровно две архитектуры и номер RuStore в манифесте — шаг игры |

**Сверять с нынешним шагом игры, а не с этой таблицей** (так при переводе и нашлись поправки выше): `backup: off` (по умолчанию) роняет
сборку, если в манифесте нет `android:allowBackup="false"`; новая проверка, которой у игры не было, —
только с решением в PR.

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

## Перевод CI — слит 30–31.10.2026

| Игра | PR |
|---|---|
| «Сени» | Nefeste/seni#43 |
| «Анамнез» | Nefeste/anamnez#193 |
| «Вотчина» | Nefeste/votchina#56 |
| «Сказы» | Nefeste/skazy#113 |
| «Нарды» | Nefeste/nardy#97 |
| «Узоры» | Nefeste/uzory#128 |

## RuStore Pay (1.1.0)

Слит: «Нарды» — Nefeste/nardy#98, «Узоры» — Nefeste/uzory#129; «Сказы» — Nefeste/skazy#114.

Игры с RuStore Pay — «Нарды», «Сказы», «Узоры». Перевод — после тега `v1.1.0`, по одной игре:

1. `npm install github:Nefeste/gornitsa-kit#v1.1.0` — в `package.json` встаёт
   `"@gornitsa/kit": "github:Nefeste/gornitsa-kit#v1.1.0"`, в `package-lock.json` — коммит.
2. В `app.json` вместо `./plugins/with-rustore` — `["@gornitsa/kit/rustore-pay/plugin", {…}]`;
   `plugins/with-rustore.js` удаляется (у «Нард» модуль оценки остаётся своим, ему нужен только
   maven RuStore — `otherStore: "maven"`).
3. `src/money/rustore.ts` — реэкспорт из `@gornitsa/kit/rustore-pay` (или удаляется, а импорты
   переходят на пакет); общая часть правил (`rsCode`, `rsText`, `rsDetail`, причины, покупка)
   — из пакета, права по списку покупок остаются в игре.
4. Тесты плагина и обёртки в игре сокращаются до того, что своё: настройки в `app.json` и права.

| Игра | `scheme` | `noAppId` | `otherStore` | тема шторки |
|---|---|---|---|---|
| «Нарды» | `gornitsanardypay` | `stub` | `maven` (оценка в RuStore) | `DARK` |
| «Сказы» | `gornitsaskazypay` | `stub` | `skip` | `LIGHT` |
| «Узоры» | `gornitsauzorypay` | `skip` | `skip` | `LIGHT` |

**Схема — вечная:** она в манифесте выпущенных сборок и в возврате из приложения банка; менять её
нельзя.
