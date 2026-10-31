// из nardy: src/money/rustore.ts @ 08bdc90 — нативный модуль RuStore Pay; типы — index.d.ts.
// Android-часть обёртки приходит из maven RuStore и регистрируется плагином ./plugin.js.
import { NativeModules } from 'react-native';

/** Оплата RuStore; `null` — модуля в сборке нет (Expo Go, веб, сборка без плагина или `other`). */
export const pay = NativeModules.RuStoreReactPaySDKModule ?? null;

export * from './rules.js';
