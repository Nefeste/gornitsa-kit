// Реклама Яндекса (РСЯ) в играх студии: одна версия Yandex Mobile Ads SDK на все игры. Решение
// владельца 19.11.2026: «поместить в gornitsa-kit, чтобы все проекты использовали актуальную версию SDK».
// Версия здесь — та, что опубликована и в npm (`yandex-mobile-ads`, обёртка для React Native), и в
// Maven Central (`com.yandex.android:mobileads`, её тянет обёртка): обёртка той же версии закрепляет
// нативный SDK. Новая версия SDK — PR сюда (поднять `version` и `checked`), новый тег набора, и игры
// с рекламой поднимают у себя зависимость: их тест (`checkAdsSdk`) падает, пока версия старше.
// Чистые функции без React Native: их гоняют тесты набора и игр под Node и Bun.

/** Актуальная версия SDK для игр студии. `checked` — когда сверено с npm и Maven Central. */
export const YANDEX_ADS = Object.freeze({
  npm: 'yandex-mobile-ads',
  maven: 'com.yandex.android:mobileads',
  version: '8.6.0',
  checked: '2026-11-19',
});

/** Версия X.Y.Z из записи `package.json` («8.6.0», «^8.6.0», «~8.6.0»); иначе — `null`. */
export function versionOf(range) {
  const m = typeof range === 'string' ? /^[\^~]?(\d+)\.(\d+)\.(\d+)$/.exec(range.trim()) : null;
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Сравнение версий X.Y.Z: < 0 — `a` старше (раньше), 0 — равны, > 0 — новее. */
export function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * Проверка игры по её `package.json`: зависимость `yandex-mobile-ads` записана точной версией или
 * диапазоном `^`/`~` и не старше версии набора. Рекламы в игре нет — проверять нечего (`null`).
 * Возвращает текст ошибки для теста или `null`.
 */
export function checkAdsSdk(pkg) {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const range = deps[YANDEX_ADS.npm];
  if (range === undefined) return null;
  const have = versionOf(range);
  if (!have) return `${YANDEX_ADS.npm}: «${range}» — нужна версия X.Y.Z (можно с ^ или ~)`;
  const want = versionOf(YANDEX_ADS.version);
  if (compare(have, want) < 0) {
    return `${YANDEX_ADS.npm} ${have.join('.')} старше версии набора ${YANDEX_ADS.version}: ` +
      `npx expo install ${YANDEX_ADS.npm}@${YANDEX_ADS.version}`;
  }
  return null;
}
