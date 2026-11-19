/** Актуальная версия Yandex Mobile Ads SDK для игр студии. */
export declare const YANDEX_ADS: Readonly<{ npm: 'yandex-mobile-ads'; maven: 'com.yandex.android:mobileads'; version: string; checked: string }>;
/** Версия X.Y.Z из записи `package.json` («8.6.0», «^8.6.0», «~8.6.0»); иначе — `null`. */
export declare function versionOf(range: unknown): [number, number, number] | null;
/** Сравнение версий: < 0 — `a` старше, 0 — равны, > 0 — новее. */
export declare function compare(a: readonly number[], b: readonly number[]): number;
/** Проверка `package.json` игры: текст ошибки или `null`. */
export declare function checkAdsSdk(pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null | undefined): string | null;
