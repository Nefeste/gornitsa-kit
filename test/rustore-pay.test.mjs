// RuStore Pay набора: вставки плагина в шаблоны Expo SDK 57, что плагин вписывает при каких переменных,
// число аргументов методов обёртки 11.1.0, ошибки SDK и покупка без отметки «товар выдан».
// Перенос тестов из nardy: tools/test/money.test.ts @ 08bdc90 и uzory: tools/test/rustore.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { buy, causeReasonOf, reasonOf, rsCode, rsDetail, rsText } from '../rustore-pay/rules.js';

const require = createRequire(import.meta.url);
const plugin = require('../rustore-pay/plugin.cjs');
const { transforms: t, plan, PAY } = plugin;
const dir = new URL('../rustore-pay/', import.meta.url);

// куски шаблонов — как их создаёт `expo prebuild` SDK 57 (сверено в «Нардах» и «Узорах»)
const PROJECT = 'allprojects {\n  repositories {\n    google()\n  }\n}\n';
const APP = 'android {\n}\n\ndependencies {\n    implementation("com.facebook.react:react-android")\n}\n';
const APPLICATION = 'package games.gornitsa.nardy\n\nimport android.app.Application\nimport com.facebook.react.PackageList\n\n' +
  '      packageList =\n        PackageList(this).packages.apply {\n          // add(MyReactNativePackage())\n        }\n';
const ACTIVITY = 'package games.gornitsa.nardy\n\nimport android.os.Build\nimport android.os.Bundle\n\nclass MainActivity : ReactActivity() {\n' +
  '  override fun onCreate(savedInstanceState: Bundle?) {\n    setTheme(R.style.AppTheme);\n    super.onCreate(null)\n  }\n}\n';
const ALL = ['projectBuildGradle', 'appBuildGradle', 'mainApplication', 'mainActivity', 'manifest'];

test('плагин: вставки встают в шаблоны Expo SDK 57 и не повторяются; maven RuStore — только для ru.rustore', () => {
  for (const [f, src, mark] of [
    [t.projectGradle, PROJECT, 'includeGroupByRegex("ru\\\\.rustore\\\\..*")'],
    [t.appGradle, APP, `implementation("${PAY}")`],
    [t.mainApplication, APPLICATION, 'add(RuStoreReactPayPackage())'],
    [t.mainActivity, ACTIVITY, 'override fun onNewIntent(intent: Intent)'],
  ]) {
    const once = f(src);
    assert.ok(once.includes(mark), mark);
    assert.equal(f(once), once);
  }
  assert.ok(t.projectGradle(PROJECT).includes('nexus-external.rustore.ru'));
  assert.ok(t.mainActivity(ACTIVITY).includes('import ru.rustore.react.pay.RuStoreReactPayModule'));
  assert.ok(t.mainApplication(APPLICATION).includes('import ru.rustore.react.pay.RuStoreReactPayPackage'));
  assert.throws(() => t.mainActivity('class MainActivity {}'), /шаблон/);
  assert.throws(() => t.appGradle('android {}'), /шаблон/);
});

test('плагин: манифест — номер приложения, своя схема возврата из банка у главного экрана, без повторов', () => {
  const m = {
    manifest: {
      application: [{
        $: { 'android:name': '.MainApplication' },
        'meta-data': [{ $: { 'android:name': 'console_app_id_value', 'android:value': 'старый' } }],
        activity: [{ $: { 'android:name': '.MainActivity' }, 'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }] }] }],
      }],
    },
  };
  const out = t.manifest(m, '2063773260', 'gornitsauzorypay');
  const meta = Object.fromEntries(out.manifest.application[0]['meta-data'].map(d => [d.$['android:name'], d.$['android:value']]));
  assert.deepEqual(meta, { console_app_id_value: '2063773260', sdk_pay_scheme_value: 'gornitsauzorypay', internal_config_key: 'react-native' });
  t.manifest(out, '2063773260', 'gornitsauzorypay');
  const filters = out.manifest.application[0].activity[0]['intent-filter'];
  assert.equal(filters.length, 2);
  assert.deepEqual(filters[1].data, [{ $: { 'android:scheme': 'gornitsauzorypay' } }]);
  // без номера — 0: SDK встаёт, а игра сама не трогает оплату
  const empty = { manifest: { application: [{ activity: [{ $: { 'android:name': '.MainActivity' } }] }] } };
  assert.equal(t.manifest(empty, '', 'gornitsanardypay').manifest.application[0]['meta-data'][0].$['android:value'], '0');
  assert.throws(() => t.manifest({ manifest: { application: [{ activity: [] }] } }, '1', 'x'), /MainActivity/);
});

test('плагин: что вписывается при номере приложения и магазине — настройки «Нард», «Сказов» и «Узоров»', () => {
  const nardy = { scheme: 'gornitsanardypay', otherStore: 'maven' };
  const skazy = { scheme: 'gornitsaskazypay' };
  const uzory = { scheme: 'gornitsauzorypay', noAppId: 'skip' };
  const id = { EXPO_PUBLIC_RUSTORE_APP_ID: ' 2063773258 ' };
  for (const o of [nardy, skazy, uzory]) assert.deepEqual(plan(id, o), { appId: '2063773258', mods: ALL });
  // без номера: «Нарды» и «Сказы» — SDK с номером 0, «Узоры» — ничего
  assert.deepEqual(plan({}, nardy).mods, ALL);
  assert.deepEqual(plan({}, skazy).mods, ALL);
  assert.deepEqual(plan({ EXPO_PUBLIC_RUSTORE_APP_ID: '  ' }, uzory).mods, []);
  // сборка other: без оплаты; «Нардам» — maven RuStore для модуля оценки
  const other = { ...id, EXPO_PUBLIC_STORE: 'other' };
  assert.deepEqual(plan(other, nardy).mods, ['projectBuildGradle']);
  assert.deepEqual(plan(other, skazy).mods, []);
  assert.deepEqual(plan({ ...id, EXPO_PUBLIC_STORE: 'rustore' }, skazy).mods, ALL);
});

test('плагин: неверные настройки — ошибка при prebuild, а не сборка без оплаты', () => {
  for (const o of [undefined, {}, { scheme: 'Nardy' }, { scheme: 'gornitsa-pay' }, { scheme: 'ok', noAppId: 'maybe' }, { scheme: 'ok', otherStore: 'all' }]) {
    assert.throws(() => plan({}, o), /rustore-pay/);
  }
  assert.throws(() => plugin({}, { scheme: '' }), /scheme/);
});

// Методы RuStoreReactPayModule обёртки 11.1.0 и число их аргументов без промиса — javap по
// ru.rustore.sdk-wrapper.react-native:pay:11.1.0 («Нарды», 28.10.2026). Новая архитектура React Native
// не прощает другого числа аргументов. Сменилась версия обёртки — сверить заново.
const PAY_ARGS = {
  getPurchaseAvailability: 0, getProducts: 1, getPurchases: 3, getPurchase: 1, purchase: 9,
  getUserAuthorizationStatus: 0, isRuStoreInstalled: 0, openRuStore: 0, openRuStoreAuthorization: 0,
};

test('обёртка: у методов PayNative — столько аргументов, сколько в 11.1.0, и ни одного необязательного', () => {
  assert.equal(PAY, 'ru.rustore.sdk-wrapper.react-native:pay:11.1.0');
  const dts = readFileSync(new URL('index.d.ts', dir), 'utf8');
  const body = dts.slice(dts.indexOf('export interface PayNative {'));
  const block = body.slice(body.indexOf('{') + 1, body.indexOf('\n}'));
  const args = {};
  for (const m of block.matchAll(/^\s{2}(\w+)\(([^)]*)\)/gms)) {
    // запятые внутри <…> (Record<string, string>) аргументов не делят
    const params = m[2].replace(/<[^<>]*>/g, '<>').split(',').map(s => s.trim()).filter(Boolean);
    args[m[1]] = params.length;
    for (const p of params) assert.ok(!/^\w+\?:/.test(p), `${m[1]}: необязательный аргумент ${p}`);
  }
  assert.deepEqual(args, PAY_ARGS);
});

test('отметку «товар выдан» не зовёт никто — в обёртке 11.1.0 она ломает оплату', () => {
  for (const f of readdirSync(dir).filter(f => /\.(c?js)$/.test(f))) {
    assert.ok(!readFileSync(new URL(f, dir), 'utf8').includes('updateAcknowledgementState('), f);
  }
});

const err = (code, message = 'm') => Object.assign(new Error(message), { code });

test('покупка: одна стадия, без почты и идентификатора игрока, тема игры — и ничего больше', async () => {
  const done = { purchaseId: 'p1', productId: 'no_ads', invoiceId: 'i1', productType: 'NON_CONSUMABLE_PRODUCT', sandbox: true };
  const calls = [];
  let acks = 0;
  const native = {
    purchase: async (...a) => { calls.push(a); return done; },
    updateAcknowledgementState: () => { acks++; throw new Error('TurboModule method "updateAcknowledgementState" called with 2 arguments (expected argument count: 3)'); },
  };
  assert.deepEqual(await buy(native, 'no_ads', 'DARK'), { ok: true, result: done });
  assert.deepEqual(calls, [['no_ads', null, null, null, null, null, 'ONE_STEP', 'DARK', {}]]);
  assert.equal(acks, 0);
  await buy(native, 'golden_book');
  assert.equal(calls[1][7], null);
});

test('покупка: отмена, нет входа, нет сети, незнакомая ошибка', async () => {
  const refuse = code => ({ purchase: () => Promise.reject(err(code)) });
  assert.deepEqual(await buy(refuse('ProductPurchaseCancelled'), 'x'),
    { ok: false, cancelled: true, code: 'ProductPurchaseCancelled', reason: null, detail: 'ProductPurchaseCancelled: m' });
  assert.equal((await buy(refuse('RuStoreUserUnauthorizedException'), 'x')).reason, 'not-signed-in');
  assert.equal((await buy(refuse('RuStorePaymentNetworkException'), 'x')).reason, 'offline');
  const odd = await buy({ purchase: () => Promise.reject(new Error('что-то\n  своё')) }, 'x');
  assert.deepEqual(odd, { ok: false, cancelled: false, code: null, reason: null, detail: 'что-то своё' });
});

test('ошибки SDK: код, причина по коду и по тексту отказа getPurchaseAvailability, строка «Ответ RuStore»', () => {
  assert.equal(rsCode(err('RuStoreOutdatedException')), 'RuStoreOutdatedException');
  for (const e of [null, undefined, {}, { code: '' }, { code: 7 }, 'текст']) assert.equal(rsCode(e), null);
  assert.equal(reasonOf(err('RuStoreNotInstalledException')), 'no-rustore');
  assert.equal(reasonOf(err('RuStoreOutdatedException')), 'outdated');
  assert.equal(reasonOf(err('RuStorePayInvalidConsoleAppId')), 'no-app-id');
  assert.equal(reasonOf(err('ProductPurchaseException')), null);
  assert.equal(causeReasonOf('ru.rustore.sdk.core.exception.RuStoreNotInstalledException: RuStore not installed'), 'no-rustore');
  assert.equal(causeReasonOf('RUSTORE USER NOT AUTHORIZED'), 'not-signed-in');
  assert.equal(causeReasonOf('Application scheme was not provided'), 'no-scheme');
  assert.equal(causeReasonOf('Сервер ответил 500'), null);
  assert.equal(causeReasonOf(undefined), null);
  assert.equal(rsText('  а\n\tб  '), 'а б');
  assert.equal(rsText('я'.repeat(300)).length, 200);
  assert.equal(rsText('   '), undefined);
  assert.equal(rsText(5), undefined);
  assert.equal(rsDetail(err('ProductPurchaseException', 'Invoice expired')), 'ProductPurchaseException: Invoice expired');
});

test('пакет: в игру уходит только rustore-pay/, без зависимостей; ESM и плагин CommonJS', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.name, '@gornitsa/kit');
  assert.equal(pkg.type, 'module');
  assert.deepEqual(pkg.files, ['rustore-pay/']);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(typeof plugin, 'function');
});
