import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEBUG, certFrom, hex, judge } from '../actions/android-signature/signature.mjs';

const MINE = '1923707a5c0d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a6b';
const colons = h => h.toUpperCase().match(/../g).join(':');
const apksigner = h => `Signer #1 certificate DN: CN=Gornitsa\nSigner #1 certificate SHA-256 digest: ${h}\nSigner #1 certificate SHA-1 digest: 0011\n`;
const keytool = h => `Signer #1:\n\nCertificate #1:\nOwner: CN=Gornitsa\n\t SHA1: 00:11\n\t SHA256: ${colons(h)}\n`;

test('отпечаток читается из вывода apksigner и keytool', () => {
  assert.equal(certFrom(apksigner(MINE)), MINE);
  assert.equal(certFrom(keytool(MINE)), MINE);
  assert.equal(certFrom('нет подписи'), '');
  assert.equal(hex(`SHA256: ${colons(MINE)}`), MINE);
});

test('постоянный ключ: сверка с закреплённым, отладочный — ошибка', () => {
  assert.deepEqual(judge({ output: apksigner(MINE), expected: colons(MINE), permanent: 'yes' }), { ok: true, cert: MINE, label: 'постоянным ключом, отпечаток сверен', error: '' });
  assert.equal(judge({ output: apksigner(MINE), expected: '', permanent: 'yes' }).label, 'постоянным ключом');
  assert.match(judge({ output: apksigner(MINE), expected: DEBUG, permanent: 'yes' }).error, /не совпал/);
  assert.match(judge({ output: apksigner(DEBUG), expected: '', permanent: 'yes' }).error, /отладочным/);
});

test('без ключа — отладочная подпись шаблона допустима; нет отпечатка — ошибка', () => {
  assert.equal(judge({ output: apksigner(DEBUG), expected: '', permanent: 'no' }).label, 'отладочным ключом шаблона');
  assert.equal(judge({ output: 'ERROR: JAR signer', expected: '', permanent: 'no' }).ok, false);
});
