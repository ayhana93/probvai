/**
 * КЛЮЧЪТ НА ГАЛЕРИЯТА
 *
 * Проверява едно нещо: че „скрито" значи изключено, а не просто невидимо.
 *
 * ═══ ЗАЩО СИ ЗАСЛУЖАВА ТЕСТ ═══
 *
 * Скриването на екран е лесно — махаш компонента. Точно затова е и опасно:
 * лесното изглежда завършено. Данните обаче остават на един адрес разстояние
 * и всеки, който отвори конзолата на браузъра, вижда чуждите визии.
 *
 * Тестът пази стойността по подразбиране (галерията работи, освен ако изрично
 * не е изключена) и това, че низът „false" наистина я изключва — а не се
 * приема за истина, както става с всеки непразен низ в JavaScript.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { env, resetEnvCache } from '../src/env';

const original = process.env.LOOKBOOK_ENABLED;

afterEach(() => {
  if (original === undefined) delete process.env.LOOKBOOK_ENABLED;
  else process.env.LOOKBOOK_ENABLED = original;
  resetEnvCache();
});

describe('LOOKBOOK_ENABLED', () => {
  it('без стойност галерията работи', () => {
    delete process.env.LOOKBOOK_ENABLED;
    resetEnvCache();

    expect(env.LOOKBOOK_ENABLED).toBe(true);
  });

  it('„false" я изключва', () => {
    // ⚠ Тук се крие класическата грешка: `Boolean('false')` е `true`.
    // Стойността минава през изричен разбор, а не през приведение.
    process.env.LOOKBOOK_ENABLED = 'false';
    resetEnvCache();

    expect(env.LOOKBOOK_ENABLED).toBe(false);
  });

  it('„true" я включва обратно', () => {
    process.env.LOOKBOOK_ENABLED = 'true';
    resetEnvCache();

    expect(env.LOOKBOOK_ENABLED).toBe(true);
  });

  it('друга стойност спира приложението, вместо да гадае', () => {
    // Мълчаливото „не разбрах, значи включено" е най-лошият изход: галерията
    // остава отворена заради една сгрешена буква в конфигурацията.
    process.env.LOOKBOOK_ENABLED = 'da';
    resetEnvCache();

    expect(() => env.LOOKBOOK_ENABLED).toThrow();
  });
});
