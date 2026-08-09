/**
 * КАТЕГОРИЗИРАНЕ
 *
 * Правилата не са магия и няма как да са винаги верни. Тестът пази точно
 * това, което трябва да е вярно: специфичното бие общото, адресът се чете
 * като текст, и НИКОГА не се връща празно.
 */

import { describe, expect, it } from 'vitest';
import { categorize, isStyleCategory, STYLE_CATEGORIES, STYLE_INFO } from '../src/style';

describe('Категория по заглавие', () => {
  it('булчинска рокля е сватба, не елегантно', () => {
    // Заглавието съдържа и „рокля", и „булчинска". Специфичното печели,
    // защото стои по-нагоре в списъка с правила.
    expect(categorize({ title: 'Булчинска рокля с дантела' })).toBe('WEDDING');
  });

  it('спортният клин е спорт, не ежедневно', () => {
    expect(categorize({ title: 'Дамски спортен клин с висока талия' })).toBe('GYM');
  });

  it('сакото е бизнес', () => {
    expect(categorize({ title: 'Мъжко сако slim fit' })).toBe('BUSINESS');
  });

  it('английските заглавия работят като българските', () => {
    expect(categorize({ title: 'Oversized hoodie in washed black' })).toBe('STREETWEAR');
    expect(categorize({ title: 'Sequin party mini dress' })).toBe('PARTY');
  });
});

describe('Категория по адрес', () => {
  it('чете думите от пътя на адреса', () => {
    expect(
      categorize({
        productUrl: 'https://bg.shein.com/women/dresses/summer-linen-dress-p-123.html',
      }),
    ).toBe('SUMMER');
  });

  it('разкодира адреси с кирилица', () => {
    expect(
      categorize({
        productUrl:
          'https://www.emag.bg/search/' + encodeURIComponent('спортен екип'),
      }),
    ).toBe('GYM');
  });

  it('развален адрес не хвърля', () => {
    expect(() => categorize({ productUrl: '%%%не-е-адрес%%%' })).not.toThrow();
  });
});

describe('Когато не знаем нищо', () => {
  it('лятото е лято, останалото е ежедневно', () => {
    // Качена снимка без текст. По-добре разумно предположение, което се
    // сменя с едно натискане, отколкото празно поле.
    expect(categorize({ at: new Date('2026-07-15') })).toBe('SUMMER');
    expect(categorize({ at: new Date('2026-01-15') })).toBe('CASUAL');
  });

  it('никога не връща празно', () => {
    for (const input of [{}, { title: '' }, { title: '   ' }, { productUrl: null }]) {
      expect(isStyleCategory(categorize(input))).toBe(true);
    }
  });
});

describe('Списъкът', () => {
  it('всяка категория има надпис и емоджи', () => {
    for (const category of STYLE_CATEGORIES) {
      expect(STYLE_INFO[category].label.length).toBeGreaterThan(0);
      expect(STYLE_INFO[category].emoji.length).toBeGreaterThan(0);
    }
  });

  it('измислена категория не минава за категория', () => {
    expect(isStyleCategory('НЕЩО')).toBe(false);
    expect(isStyleCategory(null)).toBe(false);
  });
});
