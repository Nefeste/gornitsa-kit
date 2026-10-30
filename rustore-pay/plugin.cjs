// из nardy: plugins/with-rustore.js @ 08bdc90 — общая часть; настройки игр «Нард», «Сказов» и «Узоров»
// стали параметрами, из «Сказов» — maven RuStore только для групп ru.rustore.
//
// RuStore Pay в нативной сборке: официальная обёртка для React Native,
// `ru.rustore.sdk-wrapper.react-native:pay`. Папки android/ в играх нет (CNG), поэтому всё, что
// документация RuStore велит вписать руками, вписывается здесь:
//   - maven-репозиторий RuStore — в build.gradle проекта, только для групп ru.rustore: остальное
//     (androidx, Kotlin, трассировщик ошибок SDK) лежит в Google и Maven Central;
//   - зависимость оплаты — в build.gradle приложения;
//   - RuStoreReactPayPackage — в MainApplication (обёртка не связывается автоматически);
//   - Intent — в RuStoreReactPayModule из MainActivity при запуске и при возврате по deeplink
//     (после оплаты в приложении банка — СБП, SberPay);
//   - в манифест: console_app_id_value, sdk_pay_scheme_value и схема deeplink у MainActivity.
//
// В app.json игры:
//   ["@gornitsa/kit/rustore-pay/plugin", { "scheme": "gornitsa<игра>pay" }] (Expo найдёт plugin.cjs)
// Настройки:
//   scheme      — схема возврата из приложения банка, только строчные латинские буквы и цифры (обязательна);
//   noAppId     — что делать без номера приложения (EXPO_PUBLIC_RUSTORE_APP_ID):
//                 "stub" (по умолчанию) — SDK встаёт с номером 0, игра сама не трогает оплату;
//                 "skip" — не вписывать ничего, сборка та же, что без RuStore Pay;
//   otherStore  — сборка для других магазинов (EXPO_PUBLIC_STORE=other):
//                 "skip" (по умолчанию) — не вписывать ничего;
//                 "maven" — только maven-репозиторий (он нужен другим модулям RuStore, например оценке).
//
// Шаблоны Expo меняются от версии к версии; если вставить не удалось — исключение: молча собрать
// APK без оплаты хуже, чем не собрать.

/** Версия обёртки: методы и число их аргументов в index.d.ts сверены с ней (test/rustore-pay.test.mjs). */
const PAY = 'ru.rustore.sdk-wrapper.react-native:pay:11.1.0';
const MAVEN = 'https://nexus-external.rustore.ru/repository/maven-rustore-exposed';
const ONLY_RUSTORE = String.raw`content { includeGroupByRegex("ru\\.rustore\\..*") }`;

function fail(what) {
  throw new Error(`rustore-pay: шаблон ${what} изменился — RuStore Pay не подключён`);
}

function projectGradle(gradle) {
  if (gradle.includes(MAVEN)) return gradle;
  const all = /allprojects\s*\{\s*repositories\s*\{/;
  if (!all.test(gradle)) fail('android/build.gradle');
  return gradle.replace(all, m => `${m}\n    maven { url = uri("${MAVEN}"); ${ONLY_RUSTORE} }`);
}

function appGradle(gradle) {
  if (gradle.includes(PAY)) return gradle;
  const deps = /\ndependencies\s*\{/;
  if (!deps.test(gradle)) fail('android/app/build.gradle');
  return gradle.replace(deps, m => `${m}\n    implementation("${PAY}")`);
}

function mainApplication(src) {
  if (src.includes('RuStoreReactPayPackage')) return src;
  const list = /PackageList\(this\)\.packages\.apply\s*\{/;
  if (!list.test(src)) fail('MainApplication.kt');
  return src
    .replace(/\nimport com\.facebook\.react\.PackageList/, m => `\nimport ru.rustore.react.pay.RuStoreReactPayPackage${m}`)
    .replace(list, m => `${m}\n          add(RuStoreReactPayPackage())`);
}

function mainActivity(src) {
  if (src.includes('RuStoreReactPayModule')) return src;
  const create = /super\.onCreate\(null\)\s*\n\s*\}/;
  if (!create.test(src) || !/\nimport android\.os\.Bundle/.test(src)) fail('MainActivity.kt');
  return src
    .replace(/\nimport android\.os\.Bundle/, m => `\nimport android.content.Intent${m}\nimport ru.rustore.react.pay.RuStoreReactPayModule`)
    .replace(create, `super.onCreate(null)
    // RuStore Pay: запуск по deeplink после оплаты в приложении банка
    if (savedInstanceState == null) intent?.let { RuStoreReactPayModule.processIntent(it) }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    RuStoreReactPayModule.processIntent(intent)
  }`);
}

/** Манифест в виде xml2js, как его отдаёт withAndroidManifest. */
function manifest(m, appId, scheme) {
  const app = m.manifest.application?.[0];
  if (!app) fail('AndroidManifest.xml (application)');
  const activity = (app.activity ?? []).find(a => a.$?.['android:name'] === '.MainActivity');
  if (!activity) fail('AndroidManifest.xml (.MainActivity)');
  app['meta-data'] ??= [];
  const meta = (name, value) => {
    const item = app['meta-data'].find(d => d.$['android:name'] === name);
    if (item) item.$['android:value'] = value;
    else app['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
  };
  meta('console_app_id_value', appId || '0');
  meta('sdk_pay_scheme_value', scheme);
  meta('internal_config_key', 'react-native');
  activity['intent-filter'] ??= [];
  const has = activity['intent-filter'].some(f => (f.data ?? []).some(d => d.$['android:scheme'] === scheme));
  if (!has) {
    activity['intent-filter'].push({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }, { $: { 'android:name': 'android.intent.category.BROWSABLE' } }],
      data: [{ $: { 'android:scheme': scheme } }],
    });
  }
  return m;
}

/** Настройки игры, проверенные; ошибка — исключение при prebuild. */
function options(o = {}) {
  const { scheme, noAppId = 'stub', otherStore = 'skip' } = o;
  if (typeof scheme !== 'string' || !/^[a-z][a-z0-9]*$/.test(scheme)) throw new Error(`rustore-pay: scheme «${scheme}» — нужны строчные латинские буквы и цифры, например gornitsanardypay`);
  if (!['stub', 'skip'].includes(noAppId)) throw new Error(`rustore-pay: noAppId «${noAppId}» — stub или skip`);
  if (!['skip', 'maven'].includes(otherStore)) throw new Error(`rustore-pay: otherStore «${otherStore}» — skip или maven`);
  return { scheme, noAppId, otherStore };
}

/** Что вписать при этих переменных сборки: список правок, без Expo — его проверяют тесты. */
function plan(env, o) {
  const { noAppId, otherStore } = options(o);
  const appId = String(env.EXPO_PUBLIC_RUSTORE_APP_ID ?? '').trim();
  if (env.EXPO_PUBLIC_STORE === 'other') return { appId, mods: otherStore === 'maven' ? ['projectBuildGradle'] : [] };
  if (!appId && noAppId === 'skip') return { appId, mods: [] };
  return { appId, mods: ['projectBuildGradle', 'appBuildGradle', 'mainApplication', 'mainActivity', 'manifest'] };
}

function withRuStorePay(config, o) {
  const { scheme } = options(o);
  const { appId, mods } = plan(process.env, o);
  // Expo — из node_modules игры; здесь его нет, поэтому require только при сборке
  const p = require('expo/config-plugins');
  const text = f => c => { c.modResults.contents = f(c.modResults.contents); return c; };
  if (mods.includes('projectBuildGradle')) config = p.withProjectBuildGradle(config, text(projectGradle));
  if (mods.includes('appBuildGradle')) config = p.withAppBuildGradle(config, text(appGradle));
  if (mods.includes('mainApplication')) config = p.withMainApplication(config, text(mainApplication));
  if (mods.includes('mainActivity')) config = p.withMainActivity(config, text(mainActivity));
  if (mods.includes('manifest')) config = p.withAndroidManifest(config, c => { c.modResults = manifest(c.modResults, appId, scheme); return c; });
  return config;
}

module.exports = withRuStorePay;
module.exports.PAY = PAY;
module.exports.plan = plan;
/** Для тестов: вставки в шаблоны Expo проверяются без сборки. */
module.exports.transforms = { projectGradle, appGradle, mainApplication, mainActivity, manifest };
