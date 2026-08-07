/**
 * Общият HTTP клиент за FASHN. Ползва се и от tryon-max, и от tryon-v1.6.
 *
 * API-то е асинхронно:
 *   POST https://api.fashn.ai/v1/run        → { id }
 *   GET  https://api.fashn.ai/v1/status/{id} → { id, status, output, error }
 *
 * `return_base64: true` е задължително за нас — така изходите НЕ се
 * съхраняват на техните сървъри. Резултатът идва като `data:` URI в
 * масива `output`.
 */

import { requireEnv } from '../env';
import { ProviderError, type PollResult, type ProviderErrorCode } from './types';

const BASE_URL = process.env.FASHN_BASE_URL ?? 'https://api.fashn.ai/v1';

/** Колко секунди чакаме едно HTTP обръщение, преди да се откажем. */
const HTTP_TIMEOUT_MS = 30_000;

/**
 * Състоянията, които връща FASHN.
 * Източник: типовете в официалния TypeScript SDK.
 */
type FashnStatus =
  | 'starting'
  | 'in_queue'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'time_out';

type FashnStatusResponse = {
  id: string;
  status: FashnStatus;
  output?: string[] | null;
  error?: { name?: string; message?: string } | string | null;
};

type FashnRunResponse = { id?: string; error?: unknown };

function apiKey(): string {
  return requireEnv('FASHN_API_KEY', 'генерация през FASHN');
}

/** Превежда HTTP код в код на грешка и решава дали има смисъл да опитаме пак. */
function classify(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('PROVIDER_AUTH', `FASHN отказа ключа (${status})`, false);
  }
  if (status === 429) {
    return new ProviderError('PROVIDER_RATE_LIMIT', 'FASHN достигна лимит', true);
  }
  if (status >= 500) {
    return new ProviderError(
      'PROVIDER_UNAVAILABLE',
      `FASHN отговори с ${status}`,
      true,
    );
  }
  // 4xx: подаденото не му харесва. Повтарянето само ще харчи време.
  //
  // ВНИМАНИЕ: тук НЯМА отстъпка към по-скъп режим. Ако FASHN откаже
  // `generation_mode: 'fast'`, генерацията се проваля и кредитът се връща.
  // Тихото минаване към `quality` би било 5 пъти по-скъпо на генерация.
  return new ProviderError(
    'PROVIDER_BAD_REQUEST',
    `FASHN отказа заявката (${status}): ${body.slice(0, 300)}`,
    false,
  );
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  // Ключът се чете ИЗВЪН try-блока. Липсващ ключ е грешка в настройките,
  // не паднал доставчик — няма смисъл да се повтаря, трябва човек.
  let key: string;
  try {
    key = apiKey();
  } catch (error) {
    throw new ProviderError(
      'PROVIDER_AUTH',
      error instanceof Error ? error.message : 'Липсва FASHN_API_KEY',
      false,
    );
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(
      'PROVIDER_UNAVAILABLE',
      `FASHN не отговори: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  if (!response.ok) {
    throw classify(response.status, await response.text().catch(() => ''));
  }

  return (await response.json()) as T;
}

/** Пуска генерация и връща id-то на задачата при доставчика. */
export async function fashnRun(
  modelName: string,
  inputs: Record<string, unknown>,
): Promise<{ jobId: string }> {
  const data = await request<FashnRunResponse>('/run', {
    method: 'POST',
    body: JSON.stringify({ model_name: modelName, inputs }),
  });

  if (!data.id) {
    throw new ProviderError(
      'PROVIDER_BAD_REQUEST',
      `FASHN не върна id: ${JSON.stringify(data).slice(0, 300)}`,
      false,
    );
  }

  return { jobId: data.id };
}

/** Пита за състоянието на задача. */
export async function fashnPoll(jobId: string): Promise<PollResult> {
  const data = await request<FashnStatusResponse>(
    `/status/${encodeURIComponent(jobId)}`,
    { method: 'GET' },
  );

  switch (data.status) {
    case 'starting':
    case 'in_queue':
    case 'processing':
      return { status: 'pending' };

    case 'completed': {
      const image = data.output?.[0];
      if (!image) {
        return {
          status: 'failed',
          errorCode: 'PROVIDER_FAILED',
          detail: 'FASHN каза „готово", но не върна изображение',
        };
      }
      return { status: 'done', imageUrl: image };
    }

    case 'time_out':
      return { status: 'failed', errorCode: 'TIMEOUT', detail: 'FASHN се отказа' };

    case 'canceled':
      return {
        status: 'failed',
        errorCode: 'PROVIDER_FAILED',
        detail: 'Задачата е отменена при FASHN',
      };

    case 'failed':
    default: {
      const detail =
        typeof data.error === 'string'
          ? data.error
          : (data.error?.message ?? 'без подробности');
      const moderation = /moderation|nsfw|content polic/i.test(detail);
      return {
        status: 'failed',
        errorCode: moderation ? 'MODERATION' : 'PROVIDER_FAILED',
        detail,
      };
    }
  }
}
