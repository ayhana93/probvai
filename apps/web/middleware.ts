import { NextResponse, type NextRequest } from 'next/server';
import { ROUTE_MAP, REAL_TO_PUBLIC } from '@/lib/routes';

/**
 * ПРЕВРЪЩАНЕ НА АДРЕСИТЕ
 *
 * Публичният адрес е нечетим (`/s3tn`), файлът зад него — четим
 * (`app/(user)/nastroyki`). Този файл е единственото място, където двете се
 * срещат.
 *
 * ═══ ЗАЩО ЧЕТИМИЯТ ПЪТ ВРЪЩА 404 ═══
 *
 * Само пренасочване не е достатъчно: `/nastroyki` щеше да продължи да
 * работи и името пак се вижда — стига някой да го напише. Затова истинските
 * пътища тук се затварят. Всеки екран има точно един публичен адрес.
 *
 * ═══ КАКВО НЕ ПИПА ═══
 *
 * `/api/*` остават четими. Те не са връзки — не влизат в адресната лента,
 * нито в историята, нито в отметките. Скриването им би добавило още едно
 * място за разминаване срещу нула полза.
 *
 * ═══ ЗАЩО ТУК НЯМА ПРОВЕРКА ЗА ВХОД ═══
 *
 * Middleware-ът върви на Edge, където Prisma не работи, а сесиите ни са в
 * базата. Проверката за вход е в `app/(user)/layout.tsx`, на Node. Тук се
 * пипат само низове — за това Edge стига.
 */

/** Пътища, които минават без да ги докосваме. */
const UNTOUCHED = ['/api/', '/_next/', '/brand/', '/demo/', '/flow/', '/.well-known/'];

/**
 * ═══ ЗАЩО СА ПОДРЕДЕНИ ПО ДЪЛЖИНА ═══
 *
 * Обхождани в реда на записване, `/v2ne` хващаше `/v2ne/z7` пръв — заради
 * проверката за представка — и го пращаше на `/vhod/z7`, което не
 * съществува. Забравената парола връщаше 404, а таблицата изглеждаше вярна.
 *
 * По-дългият път се проверява пръв. Тогава специфичното винаги бие общото.
 */
const ROUTES_BY_SPECIFICITY = Object.entries(ROUTE_MAP).sort(
  ([a], [b]) => b.length - a.length,
);

const REAL_BY_SPECIFICITY = Object.keys(REAL_TO_PUBLIC).sort(
  (a, b) => b.length - a.length,
);

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  if (pathname === '/' || UNTOUCHED.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Файлове с разширение — икони, шрифтове, снимки.
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  // ── Нечетимият адрес → истинският път ───────────────────────────────────
  for (const [publicPath, realPath] of ROUTES_BY_SPECIFICITY) {
    if (pathname === publicPath) {
      return NextResponse.rewrite(new URL(realPath, request.url));
    }
    // Продължението се пренася: `/p9xz/abc` → `/proba/abc`.
    if (pathname.startsWith(`${publicPath}/`)) {
      const rest = pathname.slice(publicPath.length);
      return NextResponse.rewrite(new URL(realPath + rest, request.url));
    }
  }

  // ── Истинският път не се отваря направо ─────────────────────────────────
  // Иначе името пак се вижда — достатъчно е да го напишеш.
  for (const realPath of REAL_BY_SPECIFICITY) {
    if (pathname === realPath || pathname.startsWith(`${realPath}/`)) {
      return NextResponse.rewrite(new URL('/nyama', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
