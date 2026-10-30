// из votchina: tools/store/rustore.mjs @ 9d1a2de — пакет стал параметром, вызов — функцией для тестов.
// Загрузка APK в черновик новой версии в RuStore.
//
//   RUSTORE_KEY_ID=<номер ключа> RUSTORE_API_TOKEN=<приватный ключ, base64> \
//     node upload.mjs --package games.gornitsa.nardy nardy-N.apk [--submit]
//
//   --submit — сразу отправить черновик на модерацию (по умолчанию нет: владелец смотрит черновик
//              в консоли и отправляет сам).
//
// Ключ заводится в RuStore Консоли → «Компания» → «API RuStore»: таблица показывает его номер
// (keyId), приватный ключ выдаётся один раз. API: POST /public/auth/ с подписью SHA-512/RSA от
// keyId + timestamp → JWE на 15 минут в заголовке Public-Token. Черновик у приложения может быть
// только один: если он уже есть, APK грузится в него. Первую версию приложения RuStore
// принимает только через консоль.
// Обычный JS без зависимостей: запускается голым node в CI.
import { createPrivateKey, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export const API = 'https://public-api.rustore.ru';

export class UploadError extends Error {}

/** Приватный ключ из консоли: base64 от DER (PKCS#8 или PKCS#1) либо готовый PEM. */
export function privateKey(raw) {
  const text = raw.trim();
  if (text.includes('-----BEGIN')) return createPrivateKey(text);
  const der = Buffer.from(text.replace(/\s+/g, ''), 'base64');
  for (const type of ['pkcs8', 'pkcs1']) {
    try { return createPrivateKey({ key: der, format: 'der', type }); } catch { /* следующий формат */ }
  }
  throw new UploadError('RUSTORE_API_TOKEN не похож на приватный ключ RSA (ожидается base64 из консоли RuStore)');
}

/** Аргументы командной строки: пакет, файл, --submit. */
export function parseArgs(argv) {
  let pkg = '';
  let file = '';
  let submit = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--submit') submit = true;
    else if (a === '--package') pkg = argv[++i] ?? '';
    else if (a.startsWith('--package=')) pkg = a.slice('--package='.length);
    else if (!a.startsWith('--')) file = a;
    else throw new UploadError(`неизвестный ключ ${a}`);
  }
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(pkg)) throw new UploadError(`имя пакета «${pkg}» не похоже на идентификатор приложения (--package games.gornitsa.<игра>)`);
  if (!file) throw new UploadError('укажите APK: node upload.mjs --package <пакет> <файл.apk>');
  return { pkg, file, submit };
}

/**
 * Загрузка. `fetch`, чтение файла, время и журнал передаются снаружи — так её проверяют тесты
 * без сети. Возвращает номер версии-черновика.
 */
export async function upload({ pkg, file, submit, keyId, secret, fetch = globalThis.fetch, readFile = readFileSync, now = () => new Date(), log = console.log }) {
  keyId = keyId?.trim();
  if (!keyId || !secret) throw new UploadError('нужны RUSTORE_KEY_ID (номер ключа) и RUSTORE_API_TOKEN (приватный ключ)');

  async function call(token, method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { ...(token ? { 'Public-Token': token } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { code: String(res.status), message: text.slice(0, 500) }; }
    return { ok: res.ok && String(data.code).toUpperCase() === 'OK', status: res.status, data };
  }
  const why = r => r.data.message ?? JSON.stringify(r.data);

  // 1. токен: подпись keyId + timestamp
  const timestamp = now().toISOString().replace('Z', '+00:00');
  const signature = createSign('RSA-SHA512').update(keyId + timestamp, 'utf8').sign(privateKey(secret), 'base64');
  const auth = await call(null, 'POST', '/public/auth/', { keyId, timestamp, signature });
  const token = auth.data.body?.jwe;
  if (!auth.ok || !token) throw new UploadError(`авторизация не прошла (${auth.status}): ${why(auth)}`);
  log('авторизация: ок');

  // 2. черновик: новый, а если он уже есть — существующий
  let versionId;
  const draft = await call(token, 'POST', `/public/v1/application/${pkg}/version`, {});
  if (draft.ok && typeof draft.data.body === 'number') {
    versionId = draft.data.body;
    log(`черновик создан: ${versionId}`);
  } else {
    const list = await call(token, 'GET', `/public/v1/application/${pkg}/version?pageSize=20`);
    const found = (list.data.body?.content ?? []).find(v => /draft/i.test(String(v.status ?? '')));
    if (!found) throw new UploadError(`черновик не создан (${draft.status}): ${why(draft)}`);
    versionId = found.versionId;
    log(`черновик уже был: ${versionId}`);
  }

  // 3. APK
  const form = new FormData();
  form.append('file', new File([readFile(file)], basename(file), { type: 'application/vnd.android.package-archive' }));
  const up = await call(token, 'POST', `/public/v1/application/${pkg}/version/${versionId}/apk?isMainApk=true&servicesType=Unknown`, form);
  if (!up.ok) throw new UploadError(`APK не загружен (${up.status}): ${why(up)}`);
  log(`APK загружен: ${basename(file)}`);

  // 4. на модерацию — только если попросили
  if (submit) {
    const commit = await call(token, 'POST', `/public/v1/application/${pkg}/version/${versionId}/commit`);
    if (!commit.ok) throw new UploadError(`на модерацию не отправлено (${commit.status}): ${why(commit)}`);
    log('отправлено на модерацию');
  } else {
    log('черновик ждёт в консоли RuStore: проверить «Что нового» и отправить на модерацию');
  }
  return versionId;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { pkg, file, submit } = parseArgs(process.argv.slice(2));
    await upload({ pkg, file, submit, keyId: process.env.RUSTORE_KEY_ID, secret: process.env.RUSTORE_API_TOKEN });
  } catch (e) {
    console.error(`::error::${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
