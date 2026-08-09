/**
 * FASHN `tryon-max` — доставчикът по подразбиране.
 *
 * ═══ ЗАЩО ДВЕ СТОЙНОСТИ СА ЗАКОВАНИ ═══
 *
 * FASHN се таксува 1–5 свои кредита за изображение според резолюцията и
 * режима. Ние продаваме проба за €0.20; при `balanced` + `1k` доставчикът
 * взима 2 свои кредита ≈ $0.15, което още оставя марж. При `quality` + `2k`
 * себестойността минава цената и работим на загуба.
 *
 * ⚠ „Кредит" тук значи кредит НА FASHN. На потребителя не показваме кредити
 *   изобщо — за него единицата е „проба".
 *
 * Затова тези две стойности НЕ са параметри на функция, НЕ се четат от
 * средата и НЕ се приемат от клиента. Стоят тук и се променят само с
 * съзнателна промяна в кода — заедно с `costUSD` по-долу.
 *
 * ⚠ Ако промениш едното без другото, глобалният дневен таван започва да лъже
 *   и спирачката спира да работи.
 */

import { buildPrompt } from '../prompt';
import { fashnPoll, fashnRun } from './fashn-client';
import type { AspectRatio, PollResult, RunInput, TryOnProvider } from './types';

const MODEL_NAME = 'tryon-max';

/**
 * FASHN Try-On Max configuration.
 *
 * BALANCED + 1K
 *
 * Do not change these values without also updating COST_USD below.
 */
const FIXED_SETTINGS = {
  generation_mode: 'balanced',
  resolution: '1k',
} as const;

/**
 * FASHN cost for one generated image:
 *
 * balanced + 1k = 2 FASHN credits
 * 1 FASHN credit = $0.075
 * Total = $0.15 per generation
 */
const COST_USD = 0.15;

/**
 * Aspect ratios supported by FASHN Try-On Max.
 *
 * "auto" is handled separately and means that
 * no aspect_ratio is sent to FASHN.
 */
const SUPPORTED_RATIOS = new Set([
  '21:9',
  '16:9',
  '5:4',
  '4:3',
  '3:2',
  '1:1',
  '2:3',
  '3:4',
  '4:5',
  '9:16',
]);

function aspectRatioInput(
  aspectRatio: AspectRatio
): Record<string, string> {
  // "auto" means: let FASHN decide based on the input.
  if (aspectRatio === 'auto') {
    return {};
  }

  // Ignore unsupported aspect ratios instead of sending
  // an invalid value to FASHN.
  if (!SUPPORTED_RATIOS.has(aspectRatio)) {
    return {};
  }

  return {
    aspect_ratio: aspectRatio,
  };
}

export class FashnTryonMax implements TryOnProvider {
  readonly name = 'fashn_tryon_max' as const;

  /**
   * Estimated provider cost for one generated image.
   */
  readonly costUSD = COST_USD;

  readonly supportsAspectRatio = true;

  async run(input: RunInput): Promise<{ jobId: string }> {
    return fashnRun(MODEL_NAME, {
      model_image: input.personUrl,
      product_image: input.garmentUrl,

      // Fixed FASHN configuration:
      // balanced + 1k
      ...FIXED_SETTINGS,

      // Only send aspect_ratio when valid.
      ...aspectRatioInput(input.aspectRatio),

      /**
       * Указанието. НИКОГА не е само това, което човекът е написал.
       *
       * `buildPrompt` слага отпред правилата за самоличността — лицето,
       * стойката и фигурата не се пипат. Те важат и когато полето е празно,
       * защото са условие на продукта, а не пожелание на потребителя.
       * Виж `packages/core/src/prompt.ts`.
       */
      prompt: buildPrompt(input.prompt),

      // Generate exactly one image per request.
      num_images: 1,

      // JPEG keeps file size smaller for the web.
      output_format: 'jpeg',

      // FASHN returns the generated image as base64.
      // It does not remain stored on FASHN servers.
      return_base64: true,
    });
  }

  async poll(jobId: string): Promise<PollResult> {
    return fashnPoll(jobId);
  }
}
