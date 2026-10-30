// Проверка подписи готового APK или AAB по выводу apksigner (APK) или keytool (AAB).
// Логика — из votchina: .github/workflows/android.yml @ fe98c02, шаг «Check the signature».
//
//   node signature.mjs <вывод инструмента> <ожидаемый отпечаток или ""> <yes|no — подложен ли ключ>
//   → печатает JSON {ok, cert, label, error}
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Общеизвестный отладочный ключ React Native из шаблона. */
export const DEBUG = 'fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c';

/** Отпечаток в виде 64 строчных шестнадцатеричных знаков: без «:», пробелов и приставки SHA-256. */
export function hex(s) {
  return String(s ?? '').trim().replace(/^sha-?256:?/i, '').toLowerCase().replace(/[:\s]/g, '');
}

/** SHA-256 сертификата из строки «… SHA-256 digest: …» (apksigner) или «SHA256: AB:CD…» (keytool). */
export function certFrom(output) {
  for (const line of String(output).split('\n')) {
    const m = line.match(/(?:digest|sha-?256):?\s*([0-9a-f:]{64,95})\s*$/i);
    if (m && /sha-?256/i.test(line)) {
      const h = hex(m[1]);
      if (/^[0-9a-f]{64}$/.test(h)) return h;
    }
  }
  return '';
}

/** Решение по подписи. */
export function judge({ output, expected, permanent }) {
  const cert = certFrom(output);
  const want = hex(expected);
  if (!cert) return { ok: false, cert, label: '', error: 'Не нашёл отпечаток SHA-256 в выводе (см. выше).' };
  if (permanent === 'yes') {
    if (cert === DEBUG) return { ok: false, cert, label: '', error: 'Ключ подложен, а файл подписан отладочным: плагин подписи не сработал.' };
    if (want && cert !== want) return { ok: false, cert, label: '', error: `Отпечаток ${cert} не совпал с закреплённым ${want}.` };
    return { ok: true, cert, label: want ? 'постоянным ключом, отпечаток сверен' : 'постоянным ключом', error: '' };
  }
  return { ok: true, cert, label: 'отладочным ключом шаблона', error: '' };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [outFile, expected = '', permanent = 'no'] = process.argv.slice(2);
  console.log(JSON.stringify(judge({ output: readFileSync(outFile, 'utf8'), expected, permanent })));
}
