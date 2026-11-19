// Реклама Яндекса: версия SDK набора и проверка package.json игры (yandex-ads/index.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YANDEX_ADS, checkAdsSdk, compare, versionOf } from '../yandex-ads/index.js';

test('версия набора — X.Y.Z, дата сверки — ГГГГ-ММ-ДД', () => {
  assert.ok(versionOf(YANDEX_ADS.version));
  assert.match(YANDEX_ADS.checked, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(YANDEX_ADS.npm, 'yandex-mobile-ads');
});

test('версия из записи package.json: точная, ^ и ~; прочее — null', () => {
  assert.deepEqual(versionOf('8.6.0'), [8, 6, 0]);
  assert.deepEqual(versionOf('^8.6.0'), [8, 6, 0]);
  assert.deepEqual(versionOf('~8.10.2'), [8, 10, 2]);
  for (const bad of ['latest', '>=8.0.0', '8.6', '', null, 8]) assert.equal(versionOf(bad), null);
});

test('сравнение версий — по числам, а не по строкам', () => {
  assert.ok(compare([8, 10, 0], [8, 9, 0]) > 0);
  assert.ok(compare([8, 5, 0], [8, 6, 0]) < 0);
  assert.equal(compare([8, 6, 0], [8, 6, 0]), 0);
});

test('проверка игры: без рекламы — нечего проверять; та же или новее — да; старше — ошибка с командой', () => {
  assert.equal(checkAdsSdk({ dependencies: { expo: '~57.0.0' } }), null);
  assert.equal(checkAdsSdk(null), null);
  assert.equal(checkAdsSdk({ dependencies: { 'yandex-mobile-ads': `^${YANDEX_ADS.version}` } }), null);
  const [x, y, z] = versionOf(YANDEX_ADS.version);
  assert.equal(checkAdsSdk({ dependencies: { 'yandex-mobile-ads': `${x}.${y}.${z + 1}` } }), null);
  const old = checkAdsSdk({ dependencies: { 'yandex-mobile-ads': '^8.5.0' } });
  assert.match(old, /8\.5\.0 старше версии набора/);
  assert.match(old, new RegExp(`npx expo install yandex-mobile-ads@${YANDEX_ADS.version.replace(/\./g, '\\.')}`));
  assert.match(checkAdsSdk({ dependencies: { 'yandex-mobile-ads': 'latest' } }), /нужна версия X\.Y\.Z/);
});
