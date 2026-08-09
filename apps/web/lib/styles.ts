/**
 * Имената на стиловите категории за интерфейса.
 *
 * ═══ ЗАЩО СЕ ПОВТАРЯТ ═══
 *
 * Истината е в `packages/core/src/style.ts`. Оттам обаче не може да се внесе
 * в клиентски компонент: файлът внася типове от `@probvai/db`, а с тях идва
 * и Prisma — цял сървърен пакет в bundle-а на браузъра.
 *
 * Затова тук стои огледало само с надписите. Смени ли се списъкът от
 * категории, се сменя и този файл — типът `StyleKey` кара TypeScript да го
 * забележи, ако някой добави категория и забрави надписа ѝ.
 */

export const STYLE_KEYS = [
  'BUSINESS',
  'STREETWEAR',
  'LUXURY',
  'SUMMER',
  'ELEGANT',
  'CUTE',
  'GYM',
  'WEDDING',
  'PARTY',
  'CASUAL',
  'DATE',
] as const;

export type StyleKey = (typeof STYLE_KEYS)[number];

export const STYLE_LABELS: Record<StyleKey, { label: string; emoji: string }> = {
  BUSINESS: { label: 'Бизнес', emoji: '👔' },
  STREETWEAR: { label: 'Стрийт', emoji: '🖤' },
  LUXURY: { label: 'Лукс', emoji: '💎' },
  SUMMER: { label: 'Лято', emoji: '🌴' },
  ELEGANT: { label: 'Елегантно', emoji: '🥂' },
  CUTE: { label: 'Сладко', emoji: '🎀' },
  GYM: { label: 'Спорт', emoji: '🏋️' },
  WEDDING: { label: 'Сватба', emoji: '💍' },
  PARTY: { label: 'Парти', emoji: '🌃' },
  CASUAL: { label: 'Ежедневно', emoji: '👟' },
  DATE: { label: 'Среща', emoji: '💌' },
};

export function isStyleKey(value: unknown): value is StyleKey {
  return typeof value === 'string' && (STYLE_KEYS as readonly string[]).includes(value);
}
