// из nardy: src/money/rustoreRules.ts @ 08bdc90 — общая часть: коды и тексты ошибок Pay SDK и сама покупка.
// Права по списку покупок (какой товар что открывает) у каждой игры свои и остаются в игре.
// Чистые функции без React Native: их гоняют тесты набора и игр под Node и Bun.

/** Ошибка Pay SDK: код из списка RuStore или `null`. */
export function rsCode(e) {
  const c = e?.code;
  return typeof c === 'string' && c.length > 0 ? c : null;
}

/** Текст для строки «Ответ RuStore»: в одну строку, не длиннее 200 знаков; пустой — `undefined`. */
export function rsText(s) {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
  return t || undefined;
}

/** Ошибка SDK для строки «Ответ RuStore»: код и текст, как пришли. */
export function rsDetail(e) {
  const m = e?.message;
  return rsText([rsCode(e), typeof m === 'string' ? m : ''].filter(Boolean).join(': '));
}

/**
 * Ошибки SDK, по которым игроку есть что сказать: код (имя класса), начало текста — как в Pay SDK
 * 11.1.0 и core 10.5.0 (разбор «Нард», 23.10.2026) — и причина. Неверной подписи ответа здесь нет:
 * это защита RuStore от подмены ответа, а не недоделанная сборка.
 */
export const KNOWN = Object.freeze([
  ['RuStoreNotInstalledException', 'RuStore not installed', 'no-rustore'],
  ['RuStoreOutdatedException', 'RuStore outdated', 'outdated'],
  ['RuStoreUserUnauthorizedException', 'RuStore User Not Authorized', 'not-signed-in'],
  ['RuStorePayInvalidConsoleAppId', 'Console application id is not provided', 'no-app-id'],
  ['ApplicationSchemeWasNotProvided', 'Application scheme was not provided', 'no-scheme'],
]);

/** Ошибка (отказ промиса обёртки) → причина; `null` — по ней игроку сказать нечего, кроме «ошибка». */
export function reasonOf(e) {
  const code = rsCode(e);
  if (code === 'RuStorePaymentNetworkException') return 'offline';
  return KNOWN.find(k => k[0] === code)?.[2] ?? null;
}

/**
 * Отказ `getPurchaseAvailability` → причина; `null` — текст незнакомый. Любую ошибку по дороге — сеть,
 * отказ сервера RuStore, номер приложения, нет RuStore — SDK отдаёт не исключением, а ответом
 * «недоступно», и обёртка для React Native передаёт из него только текст (`cause`).
 */
export function causeReasonOf(cause) {
  const c = String(cause ?? '').toLowerCase();
  return KNOWN.find(k => c.includes(k[1].toLowerCase()))?.[2] ?? null;
}

/**
 * Покупка: одностадийная оплата в шторке RuStore — и всё. Без почты и идентификатора игрока. Отметки
 * «товар выдан» (`updateAcknowledgementState`) нет: она необязательна (RuStore, «Признак выдачи
 * товара»), права игра берёт из списка покупок, а в обёртке 11.1.0 она ломает оплату — с двумя
 * аргументами вместо трёх модуль бросает исключение сразу («Нарды» 1.1.0: «Оплата не прошла» после
 * оплаты), с тремя её ответ роняет приложение («Нарды» 1.1.2).
 * Возвращает `{ ok: true, result }` или `{ ok: false, cancelled, code, reason, detail }`.
 */
export async function buy(pay, productId, theme = null) {
  try {
    const result = await pay.purchase(productId, null, null, null, null, null, 'ONE_STEP', theme, {});
    return { ok: true, result };
  } catch (e) {
    const code = rsCode(e);
    return { ok: false, cancelled: code === 'ProductPurchaseCancelled', code, reason: reasonOf(e), detail: rsDetail(e) };
  }
}
