/**
 * Изваждане на мета данни от HTML.
 *
 * Нарочно без библиотека за разбор на HTML. Нужни са ни три-четири тага от
 * `<head>`, а всяка библиотека за това носи мегабайти и собствени уязвимости
 * при зле оформен вход. Тук четем само атрибути и никога не изпълняваме нищо.
 */

/** Реже до края на `<head>`, ако го има — там живеят мета таговете. */
function headOnly(html: string): string {
  const end = html.search(/<\/head\s*>/i);
  return end === -1 ? html.slice(0, 200_000) : html.slice(0, end);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ');
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    tag,
  );
  const raw = match?.[2] ?? match?.[3] ?? match?.[4];
  return raw ? decodeEntities(raw.trim()) : null;
}

/**
 * Връща стойността на първия `<meta>`, чието `property` или `name`
 * съвпада с някое от подадените имена. Редът на имената е редът на
 * предпочитанието.
 */
export function metaContent(html: string, names: string[]): string | null {
  const head = headOnly(html);
  const tags = head.match(/<meta\b[^>]*>/gi) ?? [];

  const found = new Map<string, string>();

  for (const tag of tags) {
    const key = (attribute(tag, 'property') ?? attribute(tag, 'name'))?.toLowerCase();
    const content = attribute(tag, 'content');
    if (key && content && !found.has(key)) {
      found.set(key, content);
    }
  }

  for (const name of names) {
    const value = found.get(name.toLowerCase());
    if (value) return value;
  }
  return null;
}

/** `<link rel="image_src" href="...">` — стар, но още се среща. */
export function linkHref(html: string, rel: string): string | null {
  const head = headOnly(html);
  const tags = head.match(/<link\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    if (attribute(tag, 'rel')?.toLowerCase() === rel.toLowerCase()) {
      return attribute(tag, 'href');
    }
  }
  return null;
}

/** `<title>` — ползва се за името на дрехата, когато магазинът е непознат. */
export function pageTitle(html: string): string | null {
  const match = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html);
  return match?.[1] ? decodeEntities(match[1].trim()) : null;
}
