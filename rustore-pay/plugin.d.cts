export interface RuStorePayOptions {
  /** схема возврата из приложения банка: строчные латинские буквы и цифры */
  scheme: string;
  /** без EXPO_PUBLIC_RUSTORE_APP_ID: stub — SDK с номером 0 (по умолчанию), skip — ничего не вписывать */
  noAppId?: 'stub' | 'skip';
  /** сборка EXPO_PUBLIC_STORE=other: skip — ничего (по умолчанию), maven — только репозиторий RuStore */
  otherStore?: 'skip' | 'maven';
}
declare function withRuStorePay<T>(config: T, options: RuStorePayOptions): T;
export = withRuStorePay;
