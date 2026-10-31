# gornitsa-kit — общий набор студии «Горница»

Готовые шаги GitHub Actions для игр студии: загрузка в RuStore, автослияние по метке
«ревью: ок», ключ подписи Android, проверка подписи и содержимого APK. С версии 1.1.0 — и
RuStore Pay для приложения: плагин сборки, типы обёртки и покупка. Раньше каждая игра
держала свою копию. Теперь копия одна — здесь, а игры её вызывают.

Почему так: ADR студии [0002](https://github.com/Nefeste/gornitsa/blob/main/adr/0002-copy-not-share.md)
(пересмотр от 03.10.2026, решение владельца №14). Код игр по-прежнему копируется с пометкой
источника; набор начинается с CI. Что дальше переезжает в набор, решают ADR студии.

Состояние — [`STATUS.md`](STATUS.md); как перевести игру — [`docs/migration.md`](docs/migration.md);
что изменилось — [`CHANGELOG.md`](CHANGELOG.md).

## Что внутри

| Что | Вид | Заменяет в играх |
|---|---|---|
| [`.github/workflows/rustore.yml`](.github/workflows/rustore.yml) | переиспользуемый workflow | `.github/workflows/rustore.yml` целиком |
| [`.github/workflows/automerge.yml`](.github/workflows/automerge.yml) | переиспользуемый workflow | `.github/workflows/automerge.yml` и `.github/scripts/owned.mjs` |
| [`actions/rustore-upload`](actions/rustore-upload/action.yml) | действие | `tools/store/rustore.mjs` |
| [`actions/automerge`](actions/automerge/action.yml) | действие | логику автослияния (если нужен свой workflow) |
| [`actions/android-keystore`](actions/android-keystore/action.yml) | действие | шаг «Ключ подписи» / «Файл ключа» в `android.yml` |
| [`actions/android-signature`](actions/android-signature/action.yml) | действие | шаг «Подпись» / «Check the signature» |
| [`actions/android-contents`](actions/android-contents/action.yml) | действие | шаг «Содержимое» / «Check the contents» / «Check the permissions» |
| [`rustore-pay/`](rustore-pay/) | пакет `@gornitsa/kit` для приложения | `plugins/with-rustore.js`, `src/money/rustore.ts` и общую часть правил ответов RuStore |

**Workflow** — целое задание, его вызывают из своего workflow строкой `uses:` на уровне задания.
**Действие** — шаг внутри своего задания, его вызывают `uses:` на уровне шага. Сборку APK набор
не заменяет целиком: проверки, переменные и окружение у игр разные. Поэтому из `android.yml`
берутся три общих шага, а сам файл остаётся у игры.

## Как подключить

Версия — тег. Игры вызывают `@v1`: внутри `v1` ничего не ломается, новое приходит само.
Ломающее изменение — `v2`, и игры переходят на него своими PR.

### Загрузка в RuStore

```yaml
# .github/workflows/rustore.yml игры
name: RuStore
on:
  workflow_dispatch:
    inputs:
      tag: { description: 'Тег выпуска (пусто — последний)', required: false, default: '' }
      submit: { description: 'Сразу отправить на модерацию', type: boolean, default: false }
permissions:
  contents: read
jobs:
  upload:
    uses: Nefeste/gornitsa-kit/.github/workflows/rustore.yml@v1
    with:
      package: games.gornitsa.nardy
      apk: 'nardy-*.apk'
      tag: ${{ inputs.tag }}
      submit: ${{ inputs.submit }}
      key-id: ${{ vars.RUSTORE_KEY_ID }}
    secrets:
      RUSTORE_API_TOKEN: ${{ secrets.RUSTORE_API_TOKEN }}
      RUSTORE_KEY_ID: ${{ secrets.RUSTORE_KEY_ID }}
```

| Вход | Обязателен | Что это |
|---|---|---|
| `package` | да | идентификатор приложения |
| `apk` | да | шаблон имени APK в выпуске (ровно один файл) |
| `tag` | нет | тег выпуска; пусто — последний выпуск без черновиков |
| `prereleases` | нет | брать ли пре-релизы, когда тег не задан (`false`) |
| `submit` | нет | сразу отправить черновик на модерацию (`false`) |
| `key-id` | нет | номер ключа, если он в переменной репозитория |

Секреты: `RUSTORE_API_TOKEN` — приватный ключ API RuStore; `RUSTORE_KEY_ID` — номер ключа, если
он в секрете, а не в переменной. Ключ «Сборки» создаётся в RuStore Консоли → «Компания» →
«API RuStore». **Первую версию приложения RuStore принимает только через консоль.**

### Автослияние

```yaml
# .github/workflows/automerge.yml игры
name: Автослияние
on:
  pull_request_target:
    types: [labeled, unlabeled, synchronize, ready_for_review]
  workflow_run:
    workflows: [PR]               # имя workflow проверок PR этой игры
    types: [completed]
permissions:
  contents: write
  pull-requests: write
  issues: write
  actions: write                  # только если есть dispatch
  checks: read
concurrency:
  group: automerge-${{ github.event.pull_request.head.ref || github.event.workflow_run.head_branch }}
  cancel-in-progress: false
jobs:
  automerge:
    if: ${{ github.event_name == 'pull_request_target' || github.event.workflow_run.event == 'pull_request' }}
    uses: Nefeste/gornitsa-kit/.github/workflows/automerge.yml@v1
    with:
      check: 'Типы, линтер, тесты'  # имя задания проверок PR
      dispatch: server.yml          # необязательно: что запустить после слияния
      dispatch-paths: '^(server/|src/engine/|src/state/protocol\.ts$|content/)'
    secrets:
      AUTOMERGE_TOKEN: ${{ secrets.AUTOMERGE_TOKEN }}
```

Правила — как в «Вотчине» (ADR студии [0018](https://github.com/Nefeste/gornitsa/blob/main/adr/0018-change-classes-automerge.md)):
- метка одобряет **коммит**: новый коммит снимает метку;
- путь владельца из `.github/CODEOWNERS` → PR сливает владелец;
- нужны зелёная обязательная проверка и ни одной красной.

Слияние идёт squash. Если включена защита `main`, сначала включается auto-merge GitHub.

### Подпись и содержимое в `android.yml`

```yaml
      - id: key
        uses: Nefeste/gornitsa-kit/actions/android-keystore@v1
        with:
          keystore-base64: ${{ secrets.ANDROID_KEYSTORE_BASE64 }}
          store-password: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          key-alias: ${{ secrets.ANDROID_KEY_ALIAS }}
          key-password: ${{ secrets.ANDROID_KEY_PASSWORD }}
          gradle-prefix: NARDY
      - name: Сборка
        working-directory: android
        env:
          ORG_GRADLE_PROJECT_NARDY_UPLOAD_STORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ORG_GRADLE_PROJECT_NARDY_UPLOAD_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ORG_GRADLE_PROJECT_NARDY_UPLOAD_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: ./gradlew assembleRelease --no-daemon
      - id: cert
        uses: Nefeste/gornitsa-kit/actions/android-signature@v1
        with:
          file: android/app/build/outputs/apk/release/app-release.apk
          expected: ${{ vars.ANDROID_CERT_SHA256 }}
          permanent: ${{ steps.key.outputs.permanent }}
          keystore-file: ${{ steps.key.outputs.file }}
      - uses: Nefeste/gornitsa-kit/actions/android-contents@v1
        with:
          file: android/app/build/outputs/apk/release/app-release.apk
          allow-file: .github/apk-permissions.txt
          require: INTERNET
          min-target-sdk: 36
```

`android-keystore`:
- раскладывает ключ и называет его Gradle через `ORG_GRADLE_PROJECT_<PREFIX>_UPLOAD_STORE_FILE` — так его читает плагин подписи игры;
- нет секретов → `permanent=no`, подпись отладочная.

`android-signature`:
- читает отпечаток из `apksigner` (APK) или `keytool` (AAB);
- останавливает сборку, если ключ подложен, а файл подписан отладочным, или если отпечаток не совпал с `ANDROID_CERT_SHA256`;
- удаляет файл ключа;
- выходы: `sha256` и `label` — для заметок выпуска.

`android-contents`:
- разрешения по белому списку игры (`allow-file`: строка — имя, `*` в конце — любая концовка);
- запретные разрешения студии (`deny`; по умолчанию — список, которого нет в политике конфиденциальности) и игры (`forbid`, например `INTERNET` у «Анамнеза»);
- автобэкап (`backup`: `off` — обязан быть выключен, по умолчанию; `on` — включён, как у «Узоров»; `any`). Атрибута нет — значит, включён: так у Android по умолчанию;
- target API (`min-target-sdk`);
- выравнивание 64-битных библиотек на 16 КБ (`align-16k`), лишние архитектуры (`only-arm64`), размер (`max-size-mb`);
- для AAB — только то, что не зависит от манифеста.

### RuStore Pay в приложении

Пакет `@gornitsa/kit` ставится из этого репозитория по тегу — в `package.json` игры:

```json
"@gornitsa/kit": "github:Nefeste/gornitsa-kit#v1.1.0"
```

`npm install` записывает в `package-lock.json` точный коммит, `npm ci` в CI берёт его. В игру
попадает только папка `rustore-pay/` (поле `files`), зависимостей у пакета нет: React Native и
Expo — игры.

Плагин сборки — в `app.json`:

```json
["@gornitsa/kit/rustore-pay/plugin", { "scheme": "gornitsanardypay", "otherStore": "maven" }]
```

| Настройка | Что это |
|---|---|
| `scheme` | схема возврата из приложения банка после оплаты (СБП, SberPay): `gornitsa<игра>pay`, вечная, как идентификатор приложения |
| `noAppId` | без `EXPO_PUBLIC_RUSTORE_APP_ID`: `stub` — SDK встаёт с номером 0, игра не трогает оплату (по умолчанию, «Нарды», «Сказы»); `skip` — не вписывать ничего («Узоры») |
| `otherStore` | сборка `EXPO_PUBLIC_STORE=other`: `skip` — без RuStore (по умолчанию); `maven` — только репозиторий RuStore, если он нужен другому модулю (оценка в «Нардах») |

Плагин вписывает maven RuStore (только группы `ru.rustore`), зависимость обёртки
`ru.rustore.sdk-wrapper.react-native:pay:11.1.0`, пакет в `MainApplication`, возврат из банка
в `MainActivity` и в манифест — номер приложения и схему. Шаблон Expo изменился — сборка
останавливается, а не собирает APK без оплаты.

В коде игры:

```ts
import { pay, buy, reasonOf, causeReasonOf, rsDetail, type RsPurchase } from '@gornitsa/kit/rustore-pay';

const r = await buy(pay!, 'no_ads', 'DARK');   // одна стадия, без почты и id игрока
if (!r.ok && !r.cancelled) show(r.reason, r.detail);
```

- `pay` — нативный модуль или `null` (Expo Go, веб, сборка без плагина); типы методов —
  ровно обёртка 11.1.0, с явными `null`: другое число аргументов новая архитектура React Native
  не прощает.
- **Отметки «товар выдан» (`updateAcknowledgementState`) в наборе нет.** В обёртке 11.1.0 она
  ломает оплату: с двумя аргументами прошедшая оплата выглядит «Оплата не прошла», с тремя
  приложение падает («Нарды» 1.1.0 и 1.1.2). Отметка необязательна — права берутся из списка
  покупок.
- `reasonOf(e)` и `causeReasonOf(cause)` — причина по коду ошибки или по тексту отказа
  `getPurchaseAvailability`: `no-rustore`, `outdated`, `not-signed-in`, `no-app-id`, `no-scheme`,
  `offline`. Слова для игрока — в `src/i18n` игры.
- Какой товар что открывает (`ownedOf` по списку покупок) у каждой игры своё и остаётся в игре.
- Правила `rustore-pay/rules.js` без React Native — их импортируют тесты игр под Bun:
  `@gornitsa/kit/rustore-pay/rules`.

## Правила набора

- **Совместимость внутри мажорной версии.** Новый вход — только со значением по умолчанию,
  при котором поведение прежнее. Переименовать или убрать вход, сменить значение по умолчанию
  или выход — это `v2`.
- **Всё сливает владелец** (`.github/CODEOWNERS` — `*`): изменение здесь меняет CI всех игр.
  Теги ставит тоже владелец.
- **Репозиторий открытый** (ADR студии 0017): ни секретов, ни внутренних адресов в коде, тестах
  и примерах. Секреты приходят только входами и `secrets:` вызывающего workflow.
- **Логика — в `.mjs` и `rustore-pay/` с тестами**, оболочка — тонкая. Перед каждым push:
  `node --test test/*.test.mjs` и `shellcheck -S warning actions/automerge/automerge.sh`.
  CI набора ещё прогоняет `actionlint`.

## Откуда взято

| Файл | Источник |
|---|---|
| `actions/rustore-upload/upload.mjs` | `Nefeste/votchina: tools/store/rustore.mjs @ 9d1a2de` — пакет стал входом |
| `actions/automerge/automerge.sh`, `.github/workflows/automerge.yml` | `Nefeste/votchina: .github/workflows/automerge.yml @ fe98c02` — константы стали входами; ожидание слияния перед запуском workflow — из «Сказов» |
| `actions/automerge/owned.mjs` | `Nefeste/votchina: .github/scripts/owned.mjs @ 0605847` |
| `actions/android-*` | шаги `android.yml` «Вотчины», «Нард», «Сказов», «Анамнеза», «Узоров» |
| `rustore-pay/plugin.cjs` | `Nefeste/nardy: plugins/with-rustore.js @ 08bdc90` — настройки игр стали параметрами; maven только для `ru.rustore` — из «Сказов» |
| `rustore-pay/index.*`, `rules.*` | `Nefeste/nardy: src/money/rustore.ts`, `src/money/rustoreRules.ts @ 08bdc90` — общая часть |
