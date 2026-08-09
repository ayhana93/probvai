/**
 * ЦЕНАТА
 *
 * Този файл не пипа нито базата, нито Stripe. Проверява само сметката — тази,
 * която сървърът прави преди плащането и която браузърът показва на екрана.
 * Двете вече минават през ЕДНА функция; тестът пази точно това: числото на
 * екрана и числото в Stripe да са едно и също число.
 */

import { describe, expect, it } from 'vitest';
import { alignRules, formatEur, quote, type PriceRules } from '../src/pricing';

const RULES: PriceRules = { pricePerCredit: 0.2, min: 25, max: 1000, step: 5 };

describe('Сметката', () => {
  it('25 проби са точно €5.00', () => {
    const result = quote(25, RULES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.amountCents).toBe(500);
      expect(result.quote.amountEur).toBe('5.00');
    }
  });

  it('125 проби не дават 25.000000000000004', () => {
    // 125 * 0.2 в плаваща запетая е 25.000000000000004. Закръглянето на
    // центовете е причината Stripe да получи цяло число, а не боклук.
    const result = quote(125, RULES);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.quote.amountCents).toBe(2500);
      expect(Number.isInteger(result.quote.amountCents)).toBe(true);
    }
  });

  it('таванът идва от правилата, не от кода', () => {
    // Същото число, два различни тавана. Ако някой ден върне 200 в текста на
    // екрана, този тест го хваща.
    expect(quote(205, RULES)).toMatchObject({ ok: true });
    expect(quote(205, { ...RULES, max: 200 })).toMatchObject({
      ok: false,
      reason: 'ABOVE_MAXIMUM',
    });
  });

  it('под минимума и извън стъпката се отказват', () => {
    expect(quote(20, RULES)).toMatchObject({ ok: false, reason: 'BELOW_MINIMUM' });
    expect(quote(27, RULES)).toMatchObject({ ok: false, reason: 'BAD_STEP' });
  });

  it('нечисло, дроб и текст не минават', () => {
    expect(quote('50', RULES)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
    expect(quote(50.5, RULES)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
    expect(quote(null, RULES)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
    expect(quote(Number.NaN, RULES)).toMatchObject({ ok: false, reason: 'NOT_A_NUMBER' });
  });

  it('центовете стават четими', () => {
    expect(formatEur(500)).toBe('5.00');
    expect(formatEur(1240)).toBe('12.40');
    expect(formatEur(0)).toBe('0.00');
  });
});

describe('Границите се нагласят по стъпката', () => {
  /**
   * Иначе екранът предлага само стойности, които сам ще откаже: минимум 23
   * при стъпка 5 значи плъзгач, чието първо положение пада с „кратен на 5".
   */
  it('минимумът се вдига, таванът се сваля', () => {
    const aligned = alignRules({ pricePerCredit: 0.2, min: 23, max: 202, step: 5 });

    expect(aligned.min).toBe(25);
    expect(aligned.max).toBe(200);
    expect(quote(aligned.min, aligned)).toMatchObject({ ok: true });
    expect(quote(aligned.max, aligned)).toMatchObject({ ok: true });
  });

  it('таван под минимума не дава празен плъзгач', () => {
    const aligned = alignRules({ pricePerCredit: 0.2, min: 25, max: 10, step: 5 });

    expect(aligned.max).toBeGreaterThanOrEqual(aligned.min);
    expect(quote(aligned.min, aligned)).toMatchObject({ ok: true });
  });

  it('вече подредени граници остават същите', () => {
    expect(alignRules(RULES)).toEqual(RULES);
  });
});
