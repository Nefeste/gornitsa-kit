import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { API, UploadError, parseArgs, upload } from '../actions/rustore-upload/upload.mjs';

// ключ как в консоли RuStore: base64 от DER PKCS#8
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SECRET = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
const PKG = 'games.gornitsa.nardy';

/** Подставной RuStore: ответы по «метод путь» — по очереди. */
function fakeRuStore(answers) {
  const calls = [];
  const fetch = async (url, init) => {
    const path = url.slice(API.length).replace(/\?.*/, '');
    const key = `${init.method} ${path}`;
    calls.push({ key, url, init });
    const list = answers[key];
    const a = Array.isArray(list) ? list.shift() : list;
    if (!a) throw new Error(`неожиданный запрос ${key}`);
    return new Response(JSON.stringify(a.body), { status: a.status ?? 200 });
  };
  return { fetch, calls, keys: () => calls.map(c => c.key) };
}
const ok = body => ({ body: { code: 'OK', body } });
const base = { pkg: PKG, file: 'nardy-1.apk', keyId: '42', secret: SECRET, readFile: () => Buffer.from('APK'), now: () => new Date('2026-10-30T12:00:00Z'), log: () => {} };

test('новый черновик, загрузка APK, на модерацию не отправляется без --submit', async () => {
  const r = fakeRuStore({
    'POST /public/auth/': ok({ jwe: 'JWE' }),
    [`POST /public/v1/application/${PKG}/version`]: ok(777),
    [`POST /public/v1/application/${PKG}/version/777/apk`]: ok(null),
  });
  assert.equal(await upload({ ...base, submit: false, fetch: r.fetch }), 777);
  assert.deepEqual(r.keys(), ['POST /public/auth/', `POST /public/v1/application/${PKG}/version`, `POST /public/v1/application/${PKG}/version/777/apk`]);
  const auth = JSON.parse(r.calls[0].init.body);
  assert.equal(auth.keyId, '42');
  assert.equal(auth.timestamp, '2026-10-30T12:00:00.000+00:00');
  assert.ok(auth.signature.length > 300, 'подпись RSA-SHA512 в base64');
  assert.equal(r.calls[1].init.headers['Public-Token'], 'JWE');
  assert.match(r.calls[2].url, /isMainApk=true/);
});

test('черновик уже есть — APK в него; --submit отправляет на модерацию', async () => {
  const r = fakeRuStore({
    'POST /public/auth/': ok({ jwe: 'JWE' }),
    [`POST /public/v1/application/${PKG}/version`]: { status: 400, body: { code: 'ERROR', message: 'draft exists' } },
    [`GET /public/v1/application/${PKG}/version`]: ok({ content: [{ versionId: 5, status: 'ACTIVE' }, { versionId: 9, status: 'DRAFT' }] }),
    [`POST /public/v1/application/${PKG}/version/9/apk`]: ok(null),
    [`POST /public/v1/application/${PKG}/version/9/commit`]: ok(null),
  });
  assert.equal(await upload({ ...base, submit: true, fetch: r.fetch }), 9);
  assert.equal(r.keys().at(-1), `POST /public/v1/application/${PKG}/version/9/commit`);
});

test('ошибки — понятными словами', async () => {
  await assert.rejects(upload({ ...base, keyId: '', fetch: async () => { throw new Error('сети нет'); } }), /RUSTORE_KEY_ID/);
  await assert.rejects(upload({ ...base, secret: 'не ключ', fetch: async () => { throw new Error('сети нет'); } }), /не похож на приватный ключ/);
  const denied = fakeRuStore({ 'POST /public/auth/': { status: 401, body: { code: 'ERROR', message: 'bad signature' } } });
  await assert.rejects(upload({ ...base, fetch: denied.fetch }), /авторизация не прошла \(401\): bad signature/);
});

test('аргументы: пакет обязателен и похож на идентификатор', () => {
  assert.deepEqual(parseArgs(['--package', PKG, 'a.apk', '--submit']), { pkg: PKG, file: 'a.apk', submit: true });
  assert.deepEqual(parseArgs([`--package=${PKG}`, 'a.apk']), { pkg: PKG, file: 'a.apk', submit: false });
  assert.throws(() => parseArgs(['a.apk']), UploadError);
  assert.throws(() => parseArgs(['--package', 'Nardy', 'a.apk']), /не похоже/);
  assert.throws(() => parseArgs(['--package', PKG]), /укажите APK/);
});
