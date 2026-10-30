# Изменения

Версии — по правилу из [`README.md`](README.md#правила-набора): внутри мажорной версии ничего не
ломается; игры вызывают `@v1`.

## 1.1.0 — 30.10.2026

- `rustore-pay/` — RuStore Pay для приложения, пакет `@gornitsa/kit` по тегу из git:
  плагин сборки (`scheme`, `noAppId`, `otherStore`), типы обёртки 11.1.0, `pay`, `buy`, причины
  ошибок и строка «Ответ RuStore». Из «Нард» 1.1.3: без отметки «товар выдан».
- Корневой `package.json` (`"type": "module"`, в пакет уходит только `rustore-pay/`).

## 1.0.0 — 30.10.2026

Первая версия набора.

- `.github/workflows/rustore.yml`, `actions/rustore-upload` — загрузка APK из выпуска в черновик
  RuStore; пакет — входом; ровно один APK по шаблону; `prereleases`, `submit`.
- `.github/workflows/automerge.yml`, `actions/automerge` — автослияние по метке «ревью: ок» как в
  «Вотчине»: метка на коммите, пути владельца из CODEOWNERS, зелёная обязательная проверка,
  squash; `dispatch` после слияния с ожиданием до минуты.
- `actions/android-keystore`, `actions/android-signature`, `actions/android-contents` — ключ
  подписи, проверка подписи (apksigner, keytool, отладочный ключ, закреплённый отпечаток),
  содержимое (разрешения, автобэкап `off`/`on`, target API, 16 КБ, архитектуры, размер).
- Проверки набора: тесты `node --test`, `actionlint`, `shellcheck`.
