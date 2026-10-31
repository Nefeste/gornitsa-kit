// из nardy: src/money/rustore.ts @ 08bdc90 — типы обёртки RuStore Pay для React Native 11.1.0, с теми же
// именами и порядком аргументов, что в примере RuStore (react-native-rustore-pay-sdk-example,
// src/libs/RuStoreReactPay, коммит 58b0909).

export type RsProductType = 'CONSUMABLE_PRODUCT' | 'NON_CONSUMABLE_PRODUCT' | 'SUBSCRIPTION';

export interface RsProduct {
  productId: string;
  type: RsProductType;
  /** цена строкой, со знаком валюты */
  amountLabel: string;
  price?: number;
  currency: string;
  title: string;
}

export interface RsProductPurchase {
  purchaseId: string;
  productId: string;
  status: string;
  productType: RsProductType;
  acknowledgementState?: string;
  sandbox: boolean;
}

export interface RsSubscriptionPurchase {
  purchaseId: string;
  productId: string;
  status: string;
  /** дата окончания оплаченного периода, ISO 8601 */
  expirationDate: string;
  gracePeriodEnabled?: boolean;
  acknowledgementState?: string;
  sandbox: boolean;
}

export interface RsPurchase {
  productPurchase?: RsProductPurchase;
  subscriptionPurchase?: RsSubscriptionPurchase;
}

export interface RsPurchaseResult {
  purchaseId: string;
  productId: string;
  invoiceId: string;
  productType: RsProductType;
  sandbox: boolean;
}

/** Коды ошибок Pay SDK (как в примере RuStore). */
export type RsErrorCode =
  | 'RuStorePaymentNetworkException' | 'RuStorePaymentCommonException' | 'RuStorePayClientAlreadyExist'
  | 'RuStorePayClientNotCreated' | 'RuStorePayInvalidActivePurchase' | 'RuStorePayInvalidConsoleAppId'
  | 'RuStorePaySignatureException' | 'EmptyPaymentTokenException' | 'InvalidCardBindingIdException'
  | 'ApplicationSchemeWasNotProvided' | 'ProductPurchaseException' | 'ProductPurchaseCancelled'
  | 'RuStoreNotInstalledException' | 'RuStoreOutdatedException' | 'RuStoreUserUnauthorizedException'
  | 'RuStoreApplicationBannedException' | 'RuStoreUserBannedException';

/**
 * Методы `RuStoreReactPayModule` 11.1.0. Аргументов — ровно столько, сколько у метода в обёртке, и
 * необязательных нет: в новой архитектуре React Native вызов с другим числом аргументов бросает
 * исключение сразу («TurboModule method … called with 2 arguments (expected argument count: 3)»),
 * поэтому пустое значение передаётся явным `null`. Сверяет test/rustore-pay.test.mjs набора.
 *
 * `updateAcknowledgementState` (отметки «товар выдан») здесь нет намеренно: в обёртке 11.1.0 её
 * успех отдаёт в JS объект `AcknowledgementState`, React Native его не переводит, и приложение
 * падает («Нарды» 1.1.2, 28.10.2026); с двумя аргументами вместо трёх прошедшая оплата выглядела
 * «Оплата не прошла» («Нарды» 1.1.0). Отметка необязательна — обходимся без неё.
 */
export interface PayNative {
  getPurchaseAvailability(): Promise<{ availability: boolean; cause?: string }>;
  getProducts(ids: string[]): Promise<RsProduct[]>;
  getPurchases(productType: string | null, status: string | null, ack: string | null): Promise<RsPurchase[]>;
  getPurchase(purchaseId: string): Promise<RsPurchase>;
  purchase(
    productId: string, orderId: string | null, quantity: number | null, developerPayload: string | null,
    appUserId: string | null, appUserEmail: string | null, preferredPurchaseType: 'ONE_STEP' | 'TWO_STEP' | null,
    sdkTheme: 'LIGHT' | 'DARK' | null, listenerIds: Record<string, string>,
  ): Promise<RsPurchaseResult>;
  getUserAuthorizationStatus(): Promise<boolean>;
  isRuStoreInstalled(): Promise<boolean>;
  openRuStore(): Promise<void>;
  openRuStoreAuthorization(): Promise<void>;
}

/** Оплата RuStore; `null` — модуля в сборке нет (Expo Go, веб, сборка без плагина или `other`). */
export declare const pay: PayNative | null;

export * from './rules.js';
