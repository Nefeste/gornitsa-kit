import type { PayNative, RsErrorCode, RsPurchaseResult } from './index.js';

/** Причина, по которой покупки недоступны или покупка не прошла, — игра переводит её в свои слова. */
export type RsReason = 'no-rustore' | 'outdated' | 'not-signed-in' | 'no-app-id' | 'no-scheme' | 'offline';

export declare function rsCode(e: unknown): RsErrorCode | null;
export declare function rsText(s: unknown): string | undefined;
export declare function rsDetail(e: unknown): string | undefined;
export declare const KNOWN: readonly (readonly [code: RsErrorCode, text: string, reason: RsReason])[];
export declare function reasonOf(e: unknown): RsReason | null;
export declare function causeReasonOf(cause: string | undefined): RsReason | null;

export type RsBuy =
  | { ok: true; result: RsPurchaseResult }
  | { ok: false; cancelled: boolean; code: RsErrorCode | null; reason: RsReason | null; detail: string | undefined };

/** Одностадийная покупка; тема шторки — как у игры. */
export declare function buy(pay: Pick<PayNative, 'purchase'>, productId: string, theme?: 'LIGHT' | 'DARK' | null): Promise<RsBuy>;
