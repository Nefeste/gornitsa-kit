import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowFrom, backupOn, judge, permissionsFrom, targetSdkFrom } from '../actions/android-contents/contents.mjs';

const PERMS = `package: games.gornitsa.nardy
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.VIBRATE'
uses-permission-sdk-23: name='android.permission.ACCESS_NETWORK_STATE'
permission: games.gornitsa.nardy.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
uses-permission: name='games.gornitsa.nardy.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
`;
const XML_OFF = 'E: application (line=10)\n  A: http://schemas.android.com/apk/res/android:allowBackup(0x01010280)=false\n';
const XML_ON = 'E: application (line=10)\n  A: http://schemas.android.com/apk/res/android:allowBackup(0x01010280)=(type 0x12)0xffffffff\n';
const BADGING = "package: name='games.gornitsa.nardy'\nsdkVersion:'24'\ntargetSdkVersion:'36'\n";
const ALLOW = '# белый список\nandroid.permission.INTERNET\nandroid.permission.VIBRATE\nandroid.permission.ACCESS_NETWORK_STATE\ngames.gornitsa.nardy.*\n';

test('разбор вывода aapt2', () => {
  assert.deepEqual(permissionsFrom(PERMS), ['android.permission.ACCESS_NETWORK_STATE', 'android.permission.INTERNET', 'android.permission.VIBRATE', 'games.gornitsa.nardy.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION']);
  assert.equal(backupOn(XML_OFF), false);
  assert.equal(backupOn(XML_ON), true);
  assert.equal(backupOn(XML_ON.replace('(type 0x12)0xffffffff', 'true')), true);
  assert.equal(backupOn('E: application (line=10)\n'), true, 'атрибута нет — включён по умолчанию');
  assert.equal(backupOn(XML_ON.replace('0xffffffff', '0x0')), false);
  assert.equal(targetSdkFrom(BADGING), 36);
  assert.equal(targetSdkFrom(''), null);
  assert.deepEqual(allowFrom(ALLOW), ['android.permission.INTERNET', 'android.permission.VIBRATE', 'android.permission.ACCESS_NETWORK_STATE', 'games.gornitsa.nardy.*']);
});

test('всё по белому списку — ок', () => {
  const r = judge({ permissions: PERMS, xmltree: XML_OFF, badging: BADGING, settings: { allow: allowFrom(ALLOW), require: 'INTERNET', minTargetSdk: 36 } });
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('лишнее, запретное студии и запретное игры, автобэкап, старый target API — ошибки', () => {
  const extra = PERMS + "uses-permission: name='android.permission.CAMERA'\nuses-permission: name='com.google.android.gms.permission.AD_ID'\n";
  const r = judge({ permissions: extra, xmltree: XML_ON, badging: BADGING.replace("'36'", "'34'"), settings: { allow: allowFrom(ALLOW), forbid: 'INTERNET', minTargetSdk: 36 } });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 5);
  assert.match(r.errors.join('\n'), /запретное разрешение студии: .*CAMERA/);
  assert.match(r.errors.join('\n'), /запретное разрешение игры: android.permission.INTERNET/);
  assert.match(r.errors.join('\n'), /вне белого списка: .*AD_ID/);
  assert.match(r.errors.join('\n'), /allowBackup/);
  assert.match(r.errors.join('\n'), /target API 34/);
});

test('разрешения не прочитались — require ловит пустой список', () => {
  assert.match(judge({ permissions: '', xmltree: XML_OFF, badging: BADGING, settings: { require: 'INTERNET' } }).errors[0], /не прочитались/);
});

test('автобэкап: off — по умолчанию, on — как у «Узоров», any — не проверять', () => {
  const run = (xml, backup) => judge({ permissions: PERMS, xmltree: xml, badging: BADGING, settings: backup ? { backup } : {} }).ok;
  assert.equal(run(XML_OFF), true);
  assert.equal(run(XML_ON), false);
  assert.equal(run(XML_ON, 'on'), true);
  assert.equal(run(XML_OFF, 'on'), false);
  assert.equal(run(XML_ON, 'any'), true);
});
