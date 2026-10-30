// Разбор содержимого готового APK: разрешения по белому списку, автобэкап, target API.
// Логика — из «Вотчины», «Анамнеза» и «Нард» (шаги «Check the contents», «Содержимое»,
// «Check the permissions» их android.yml); здесь — общими функциями с тестами.
//
//   node contents.mjs <permissions.txt> <xmltree.txt> <badging.txt> <настройки JSON; allowFile — путь к белому списку>
//   → печатает JSON {ok, errors[], permissions[], targetSdk, backup}
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * Разрешения, которые студия не берёт ни в одной игре: их нет в политике конфиденциальности
 * (устав, docs/07-privacy.md). Игра может ослабить список только своим входом `deny`.
 */
export const STUDIO_DENY = 'EXTERNAL_STORAGE|SYSTEM_ALERT_WINDOW|AD_ID|LOCATION|CAMERA|RECORD_AUDIO|CONTACTS|READ_PHONE|CALL_LOG|SMS|MANAGE_|QUERY_ALL_PACKAGES|ACCOUNTS';

/** Имена разрешений из `aapt2 dump permissions` (или `aapt`). */
export function permissionsFrom(output) {
  const out = new Set();
  for (const line of String(output).split('\n')) {
    const m = line.match(/name='([^']+)'/);
    if (m) out.add(m[1]);
  }
  return [...out].sort();
}

/** Белый список: строки файла без комментариев и пустых; «*» в конце — любая концовка. */
export function allowFrom(text) {
  return String(text).split('\n').map(s => s.replace(/#.*/, '').trim()).filter(Boolean);
}

const matches = (name, pattern) => pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;

/**
 * Включён ли android:allowBackup по `aapt2 dump xmltree --file AndroidManifest.xml`. Атрибута
 * нет — включён: так у Android по умолчанию. aapt2 пишет значение то словом (=true / =false),
 * то числом (0xffffffff / 0x0).
 */
export function backupOn(xmltree) {
  const line = String(xmltree).split('\n').find(l => /allowBackup/.test(l));
  if (!line) return true;
  return !/=false|=\(type 0x12\)0x0\b|=0x0\b/i.test(line);
}

/** target API из `aapt2 dump badging`. */
export function targetSdkFrom(badging) {
  const m = String(badging).match(/^targetSdkVersion:'(\d+)'/m);
  return m ? Number(m[1]) : null;
}

/**
 * Проверка. settings: allow (список, пусто — не проверять), deny (регулярное выражение, по
 * умолчанию STUDIO_DENY), require (регулярное выражение, которому должно найтись разрешение,
 * например INTERNET — признак, что разрешения прочитались), forbid (дополнительно запретные,
 * например INTERNET для игры без сети), backup ('off' — автобэкап обязан быть выключен,
 * по умолчанию; 'on' — обязан быть включён, как у «Узоров»; 'any' — не проверять), minTargetSdk.
 */
export function judge({ permissions, xmltree, badging, settings }) {
  const perms = permissionsFrom(permissions);
  const errors = [];
  const s = { deny: STUDIO_DENY, allow: [], require: '', forbid: '', backup: 'off', minTargetSdk: 0, ...settings };
  if (s.require && !perms.some(p => new RegExp(s.require).test(p))) errors.push(`Нет разрешения по «${s.require}» — разрешения APK не прочитались или сборка не та.`);
  for (const [re, why] of [[s.deny, 'запретное разрешение студии'], [s.forbid, 'запретное разрешение игры']]) {
    if (!re) continue;
    const bad = perms.filter(p => new RegExp(re).test(p));
    if (bad.length) errors.push(`${why}: ${bad.join(', ')}`);
  }
  if (s.allow.length) {
    const extra = perms.filter(p => !s.allow.some(a => matches(p, a)));
    if (extra.length) errors.push(`разрешения вне белого списка: ${extra.join(', ')} — запретить в blockedPermissions в app.json или, если нужно, добавить в список (решение владельца)`);
  }
  const backup = backupOn(xmltree);
  if (s.backup === 'off' && backup) errors.push('android:allowBackup включён (или не задан — тогда он включён по умолчанию): автобэкап унёс бы ключ устройства в облако Google');
  if (s.backup === 'on' && !backup) errors.push('android:allowBackup выключен, а игра рассчитывает на автобэкап');
  const targetSdk = targetSdkFrom(badging);
  if (s.minTargetSdk && (targetSdk === null || targetSdk < s.minTargetSdk)) errors.push(`target API ${targetSdk ?? '?'}, нужно не ниже ${s.minTargetSdk}`);
  return { ok: errors.length === 0, errors, permissions: perms, targetSdk, backup };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [p, x, b, json = '{}'] = process.argv.slice(2);
  const { allowFile, ...settings } = JSON.parse(json);
  if (allowFile) settings.allow = allowFrom(readFileSync(allowFile, 'utf8'));
  console.log(JSON.stringify(judge({ permissions: readFileSync(p, 'utf8'), xmltree: readFileSync(x, 'utf8'), badging: readFileSync(b, 'utf8'), settings })));
}
