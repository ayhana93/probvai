/**
 * ЦЕНАТА НА ЕДНА ПОКУПКА — сметката, и нищо друго.
 *
 * ═══ ЗАЩО Е ОТДЕЛЕН ФАЙЛ, А НЕ ЧАСТ ОТ `payments.ts` ═══
 *
 * `payments.ts` вдига клиента на Stripe, пипа базата и праща имейли. Нищо от
 * това не бива да влиза в браузъра. А екранът за зареждане трябва да смята
 * същата цена, която сървърът ще поиска — иначе човек вижда €10.00, натиска и
 * Stripe му показва €12.40.
 *
 * Затова тук няма НИТО ЕДИН внос. Файлът е чиста аритметика и върви и от двете
 * страни. Формулата съществува на едно място; сървърът я ползва с числата от
 * средата, браузърът — със същите числа, взети от сървъра.
 *
 * ═══ ЗАЩО ЦЕНАТА НЕ Е ТУК ═══
 *
 * Правило №2 от заданието: нула твърдо зашити стойности. Цената, минимумът и
 * таванът идват от средата и се подават като `PriceRules`. Този файл знае КАК
 * се смята, не КОЛКО струва.
 */

/** Границите на еднократна покупка и цената на едно зареждане. */
export type PriceRules = {
  /** Цена на една проба в евро. */
  pricePerCredit: number;
  /** Най-малкото, което може да се зареди наведнъж. */
  min: number;
  /** Най-голямото. */
  max: number;
  /** Стъпката на плъзгача. Без нея излизат суми като €7.43. */
  step: number;
};

export type PriceQuote = {
  credits: number;
  /** Сумата в евроцентове — Stripe работи с най-малката единица. */
  amountCents: number;
  /** Същата сума за човек: „12.40". */
  amountEur: string;
};

export type QuoteFailure =
  | 'NOT_A_NUMBER'
  | 'BELOW_MINIMUM'
  | 'ABOVE_MAXIMUM'
  | 'BAD_STEP';

export type QuoteResult =
  | { ok: true; quote: PriceQuote }
  | { ok: false; reason: QuoteFailure };

/** Центове → „12.40". */
export function formatEur(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

/**
 * Смята цената на пакет проби.
 *
 * ⚠ Закръглянето е на ЦЕЛИЯ пакет, не на проба. `credits * price` в плаваща
 * запетая дава 25.000000000000004 за 125 проби по 0.20 — `Math.round` върху
 * центовете го оправя веднъж и завинаги. Затова Stripe получава цяло число, а
 * не боклук.
 */
export function quote(credits: unknown, rules: PriceRules): QuoteResult {
  if (typeof credits !== 'number' || !Number.isInteger(credits)) {
    return { ok: false, reason: 'NOT_A_NUMBER' };
  }
  if (credits < rules.min) return { ok: false, reason: 'BELOW_MINIMUM' };
  if (credits > rules.max) return { ok: false, reason: 'ABOVE_MAXIMUM' };
  if (credits % rules.step !== 0) return { ok: false, reason: 'BAD_STEP' };

  const amountCents = Math.round(credits * rules.pricePerCredit * 100);

  return {
    ok: true,
    quote: { credits, amountCents, amountEur: formatEur(amountCents) },
  };
}

/**
 * Оправя границите, за да са достижими със стъпката.
 *
 * ═══ ЗАЩО ИЗОБЩО ТРЯБВА ═══
 *
 * Границите идват от средата, стъпката е наша. Сложи ли някой ден
 * `MIN_PURCHASE_CREDITS=23` при стъпка 5, плъзгачът тръгва от 23 и всяко
 * негово положение — 23, 28, 33 — пада с „броят трябва да е кратен на 5".
 * Екран, който предлага само невалидни стойности, изглежда счупен, а вината е
 * в един ред от конфигурацията.
 *
 * Затова минимумът се вдига до следващата стъпка, таванът се сваля до
 * предишната, и никога не се обявява граница, която самата проверка би
 * отхвърлила.
 */
export function alignRules(rules: PriceRules): PriceRules {
  const step = Math.max(1, Math.round(rules.step));
  const min = Math.max(step, Math.ceil(rules.min / step) * step);
  const max = Math.max(min, Math.floor(rules.max / step) * step);

  return { pricePerCredit: rules.pricePerCredit, min, max, step };
}
