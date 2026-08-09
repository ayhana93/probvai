/**
 * ПРАВИЛАТА, КОИТО ВИНАГИ ОТИВАТ ПРИ ДОСТАВЧИКА
 *
 * ═══ ЗАЩО СЪЩЕСТВУВА ТОЗИ ФАЙЛ ═══
 *
 * Моделът за проба на дрехи е генеративен: подадеш ли му само две снимки, той
 * пресъздава човека наново. Понякога излиза с леко друго лице, друга стойка
 * или различна фигура. За приложение, което казва „виж как ТИ стои", това не
 * е дребен дефект — то е точно обратното на обещанието.
 *
 * Затова всяка заявка носи едни и същи указания, независимо какво е написал
 * човекът. Те не са предложение към него, а условие на продукта.
 *
 * ═══ ЗАЩО СА НА АНГЛИЙСКИ ═══
 *
 * Моделите за изображения се обучават предимно на английски и следват по-
 * точно указания на него. Това е единственият текст в приложението, който не
 * е на български — и е така, защото не го чете човек.
 *
 * ═══ ЗАЩО ПРАВИЛАТА СА ПРЕДИ ТЕКСТА НА ЧОВЕКА ═══
 *
 * При равни други условия по-ранното в указанието тежи повече. Човек може да
 * напише „направи ме по-слаб" — правилата отгоре трябва да го надделеят, а не
 * обратното. Затова неговият текст идва последен и е изрично обозначен като
 * ДОПЪЛНЕНИЕ, а не като замяна.
 */

/**
 * Какво НИКОГА не се пипа.
 *
 * Изброено поотделно, не в едно изречение: моделите пропускат подчинени
 * изречения по-често, отколкото отделни точки.
 */
const IDENTITY_RULES = [
  'Change ONLY the clothing, footwear and accessories.',
  'Keep the face exactly as in the original photo — same features, same expression, same skin tone.',
  'Never swap, beautify, retouch or regenerate any face.',
  'If more than one person is visible, every face stays unchanged.',
  'Keep the hair, body shape, weight, height and posture exactly as they are.',
  'Keep the background, lighting and camera angle of the original photo.',
  'Do not add or remove people, and do not add text, logos or watermarks.',
].join(' ');

/** Докъде се реже текстът на човека. Същото число важи и в интерфейса. */
export const MAX_USER_PROMPT = 300;

/**
 * Сглобява указанието към доставчика.
 *
 * Празен текст от човека е нормалният случай — тогава отиват само правилата.
 */
export function buildPrompt(userPrompt?: string | null): string {
  const clean = (userPrompt ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_USER_PROMPT);

  if (clean.length === 0) return IDENTITY_RULES;

  return `${IDENTITY_RULES} Additional request from the user, applies only to the clothing: ${clean}`;
}
