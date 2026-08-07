/**
 * FASHN `tryon-max` — доставчикът по подразбиране.
 *
 * ═══ ЗАЩО ДВЕ СТОЙНОСТИ СА ЗАКОВАНИ ═══
 *
 * FASHN се таксува 1–5 кредита за изображение според резолюцията и режима.
 * Ние продаваме кредит за €0.20, значи само `fast` + `1k` дава приемлив марж.
 * При `quality` + `2k` себестойността скача над €0.20 и работим на загуба.
 *
 * Затова тези две стойности НЕ са параметри на функция, НЕ се четат от
 * средата и НЕ се приемат от клиента. Стоят тук и се променят само с
 * съзнателна промяна в кода — заедно с `costUSD` по-долу.
 *
 * ⚠ Ако промениш едното без другото, глобалният дневен таван започва да лъже
 *   и спирачката спира да работи.
 */

import { fashnPoll, fashnRun } from './fashn-client';
import type { AspectRatio, PollResult, RunInput, TryOnProvider } from './types';

const MODEL_NAME = 'tryon-max';

const FIXED_SETTINGS = {
  generation_mode: 'fast', // НЕ променяй. Определя себестойността.
  resolution: '1k', // НЕ променяй. Определя себестойността.
} as const;

/**
 * ⚠ ВНИМАНИЕ ЗА `resolution`: FASHN приема стойността с МАЛКА буква — `1k`.
 * В заданието е записана като `1K`. Изпратено с главна буква, API-то
 * отхвърля заявката.
 */

/** Себестойност за едно изображение при fast + 1k. Върви заедно с горното. */
const COST_USD = 0.075;

/**
 * Съотношенията, които FASHN приема за този модел.
 * Нашият списък (`ALLOWED_ASPECT_RATIOS`) е подмножество, без `auto`.
 */
const SUPPORTED_RATIOS = new Set([
  '21:9', '16:9', '5:4', '4:3', '3:2', '1:1', '2:3', '3:4', '4:5', '9:16',
]);

function aspectRatioInput(aspectRatio: AspectRatio): Record<string, string> {
  // `auto` значи „не казвай нищо на доставчика" — той решава по входа.
  if (aspectRatio === 'auto') return {};
  if (!SUPPORTED_RATIOS.has(aspectRatio)) return {};
  return { aspect_ratio: aspectRatio };
}

export class FashnTryonMax implements TryOnProvider {
  readonly name = 'fashn_tryon_max' as const;
  readonly costUSD = COST_USD;
  readonly supportsAspectRatio = true;

  async run(input: RunInput): Promise<{ jobId: string }> {
    return fashnRun(MODEL_NAME, {
      model_image: input.personUrl,
      product_image: input.garmentUrl,

      ...FIXED_SETTINGS,
      ...aspectRatioInput(input.aspectRatio),

      num_images: 1,
      output_format: 'jpeg',

      // Изходът се връща като base64 и НЕ остава на сървърите на FASHN.
      return_base64: true,
    });
  }

  async poll(jobId: string): Promise<PollResult> {
    return fashnPoll(jobId);
  }
}
