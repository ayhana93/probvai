/**
 * Прави `APPLE_SECRET` за „Вход с Apple".
 *
 * ═══ ЗАЩО ИЗОБЩО ТРЯБВА СКРИПТ ═══
 *
 * Google и Facebook дават готов низ за тайна и това е. Apple не дава.
 * Техният „client secret" е JWT, който ти сам подписваш с частен ключ,
 * и той ИЗТИЧА — най-много след шест месеца.
 *
 * Тоест: сложиш ли го веднъж и забравиш, входът с Apple спира да работи
 * някой ден без никаква промяна по кода. Затова скриптът печата и датата
 * на изтичане — сложи си напомняне за седмица преди нея.
 *
 * ═══ КАКВО ТРЯБВА ═══
 *
 *   TEAM_ID     10 знака, горе вдясно в developer.apple.com
 *   SERVICE_ID  идентификаторът на Service ID, напр. bg.probvai.web
 *   KEY_ID      10 знака, от ключа за „Sign in with Apple"
 *   .p8 файл    ключът, сваля се ЕДИН път и после не може пак
 *
 * Пускане:
 *   node scripts/apple-secret.mjs \
 *     --team ABCDE12345 \
 *     --service bg.probvai.web \
 *     --key K1234ABCDE \
 *     --p8 ~/Downloads/AuthKey_K1234ABCDE.p8
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Apple не приема по-дълъг срок. Шест месеца минус ден за спокойствие. */
const MAX_DAYS = 180;

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fail(message) {
  console.error(`\n  ✗ ${message}\n`);
  process.exit(1);
}

const teamId = arg('team');
const serviceId = arg('service');
const keyId = arg('key');
const p8Path = arg('p8');

if (!teamId || !serviceId || !keyId || !p8Path) {
  fail(
    'Липсва нещо. Пример:\n' +
      '    node scripts/apple-secret.mjs --team ABCDE12345 \\\n' +
      '      --service bg.probvai.web --key K1234ABCDE \\\n' +
      '      --p8 ~/Downloads/AuthKey_K1234ABCDE.p8',
  );
}

let privateKey;
try {
  privateKey = createPrivateKey(readFileSync(p8Path, 'utf8'));
} catch (error) {
  fail(`Не мога да прочета ключа от ${p8Path}: ${String(error)}`);
}

const now = Math.floor(Date.now() / 1000);
const expires = now + MAX_DAYS * 24 * 60 * 60;

const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
const payload = {
  iss: teamId,
  iat: now,
  exp: expires,
  aud: 'https://appleid.apple.com',
  sub: serviceId,
};

const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

// ⚠ `ieee-p1363`, не DER. Node подписва с DER по подразбиране, а JWT иска
// суровите R и S едно след друго. Сгрешено тук, Apple връща
// „invalid_client" — съобщение, което не сочи към нищо.
const signature = sign('SHA256', Buffer.from(signingInput), {
  key: privateKey,
  dsaEncoding: 'ieee-p1363',
});

const token = `${signingInput}.${signature.toString('base64url')}`;

console.log('\n  APPLE_SECRET (сложи го в Railway → Variables):\n');
console.log(token);
console.log(
  `\n  Изтича на ${new Date(expires * 1000).toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}.`,
);
console.log('  Сложи си напомняне седмица по-рано — след тази дата входът');
console.log('  с Apple спира да работи, без нищо по кода да се е променило.\n');
