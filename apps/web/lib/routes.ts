/**
 * АДРЕСИТЕ НА ЕКРАНИТЕ
 *
 * ═══ ЗАЩО СА НЕЧЕТИМИ ═══
 *
 * Решение на клиента: в адресната лента да не личи кой екран се гледа.
 * Затова публичният адрес на настройките е `/s3tn`, а не `/nastroyki`.
 *
 * ═══ КАКВО ТОВА НЕ ПРАВИ ═══
 *
 * Не е защита и не бива да се мисли за такава. Целият списък екрани стои в
 * JavaScript-а, който браузърът и без това сваля — всеки, който отвори
 * инструментите за разработка, го вижда за трийсет секунди. Скриването на
 * имената е козметика, не преграда.
 *
 * Истинската защита е другаде и си е на място: проверката за вход в
 * `app/(user)/layout.tsx` и Row Level Security в базата. Те не зависят от
 * това как изглежда адресът.
 *
 * ═══ ЗАЩО ПАПКИТЕ ОСТАВАТ ЧЕТИМИ ═══
 *
 * `app/(user)/nastroyki/page.tsx` си остава с това име. Преименуваме ли и
 * папките, кодът става нечетим за нас, без да става по-затворен за когото и
 * да било. Превръщането е на едно място — в middleware-а, който чете точно
 * тази таблица.
 *
 * ═══ ВНИМАНИЕ ПРИ ПРОМЯНА ═══
 *
 * Тези низове са в отметките и в историята на браузърите на хората. Смени
 * ли се низ, старият адрес спира да работи. Добавяй нови, не пипай стари.
 */

/** Публичният адрес → истинският път до файла. */
export const ROUTE_MAP: Record<string, string> = {
  '/g7kq': '/garderob',
  '/k4mv': '/krediti',
  '/k4mv/ok': '/krediti/uspeh',
  '/p9xz': '/proba',
  '/s3tn': '/nastroyki',
  '/s3tn/ph2': '/nastroyki/snimka',
  '/s3tn/dx8': '/nastroyki/eksport',
  '/d6ry': '/dovarshi',
  '/w1': '/start',
  '/v2ne': '/vhod',
  '/v2ne/z7': '/vhod/zabravena',
  '/r5wd': '/registraciya',
  '/pv4': '/poveritelnost',
  '/us9': '/usloviya',
  '/hp6': '/podkrepa',
};

/** Истинският път → публичният адрес. Прави се от горната таблица. */
export const REAL_TO_PUBLIC: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_MAP).map(([publicPath, realPath]) => [realPath, publicPath]),
);

/**
 * Имена за ползване в кода. `Link href={R.settings}` се чете, а
 * `Link href="/s3tn"` не се чете от никого, включително от нас.
 */
export const R = {
  home: '/',
  wardrobe: '/g7kq',
  credits: '/k4mv',
  creditsDone: '/k4mv/ok',
  tryOn: '/p9xz',
  settings: '/s3tn',
  photo: '/s3tn/ph2',
  dataExport: '/s3tn/dx8',
  completeProfile: '/d6ry',
  start: '/w1',
  login: '/v2ne',
  forgotPassword: '/v2ne/z7',
  register: '/r5wd',
  privacy: '/pv4',
  terms: '/us9',
  support: '/hp6',
} as const;

/** Адресът на една проба: `/p9xz/{id}`. */
export function tryOnResult(generationId: string): string {
  return `${R.tryOn}/${generationId}`;
}
