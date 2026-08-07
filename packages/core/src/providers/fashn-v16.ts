/**
 * FASHN `tryon-v1.6` — по-стар модел, същата цена.
 *
 * ⚠ ДВЕ РАЗЛИКИ ОТ `tryon-max`, които заданието не отразява:
 *
 * 1. Няма `generation_mode` и `resolution`. Себестойността се управлява от
 *    едно поле `mode` със стойности `performance` | `balanced` | `quality`.
 *    Заковаваме `performance` — най-евтиното.
 *
 * 2. НЯМА `aspect_ratio`. Този модел връща родното съотношение на входа.
 *    Изборът на потребителката се пренебрегва тук — затова
 *    `supportsAspectRatio` е `false` и интерфейсът може да я предупреди.
 *
 * 3. Полето за дрехата се казва `garment_image`, а не `product_image`.
 */

import { fashnPoll, fashnRun } from './fashn-client';
import type { PollResult, RunInput, TryOnProvider } from './types';

const MODEL_NAME = 'tryon-v1.6';

const FIXED_SETTINGS = {
  mode: 'performance', // НЕ променяй. Определя себестойността.
} as const;

const COST_USD = 0.075;

export class FashnV16 implements TryOnProvider {
  readonly name = 'fashn_v16' as const;
  readonly costUSD = COST_USD;
  readonly supportsAspectRatio = false;

  async run(input: RunInput): Promise<{ jobId: string }> {
    return fashnRun(MODEL_NAME, {
      model_image: input.personUrl,
      garment_image: input.garmentUrl,

      ...FIXED_SETTINGS,

      // `auto` оставя модела сам да познае вида и вида на снимката.
      category: 'auto',
      garment_photo_type: 'auto',

      num_samples: 1,
      output_format: 'jpeg',
      return_base64: true,
    });
  }

  async poll(jobId: string): Promise<PollResult> {
    return fashnPoll(jobId);
  }
}
