/**
 * fal.ai `image-apps-v2/virtual-try-on` — резервният доставчик.
 *
 * По-евтин ($0.040), ползва се когато FASHN е паднал или скъп.
 *
 * Опашката на fal работи така:
 *   POST https://queue.fal.run/{model}                        → { request_id }
 *   GET  https://queue.fal.run/{model}/requests/{id}/status    → { status }
 *   GET  https://queue.fal.run/{model}/requests/{id}           → резултатът
 *
 * Автентикацията е `Authorization: Key <ключ>` — не `Bearer`.
 */

import { requireEnv } from '../env';
import { ProviderError, type PollResult, type RunInput, type TryOnProvider } from './types';

const MODEL_PATH = 'fal-ai/image-apps-v2/virtual-try-on';
const QUEUE_BASE = process.env.FAL_QUEUE_BASE ?? 'https://queue.fal.run';
const HTTP_TIMEOUT_MS = 30_000;

const COST_USD = 0.04;

type FalStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ERROR';

type FalSubmitResponse = { request_id?: string };
type FalStatusResponse = { status?: FalStatus; error?: unknown };
type FalResultResponse = {
  image?: { url?: string };
  images?: { url?: string }[];
  error?: unknown;
};

function apiKey(): string {
  return requireEnv('FAL_API_KEY', 'генерация през fal.ai');
}

function classify(status: number, body: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('PROVIDER_AUTH', `fal.ai отказа ключа (${status})`, false);
  }
  if (status === 429) {
    return new ProviderError('PROVIDER_RATE_LIMIT', 'fal.ai достигна лимит', true);
  }
  if (status >= 500) {
    return new ProviderError('PROVIDER_UNAVAILABLE', `fal.ai отговори с ${status}`, true);
  }
  return new ProviderError(
    'PROVIDER_BAD_REQUEST',
    `fal.ai отказа заявката (${status}): ${body.slice(0, 300)}`,
    false,
  );
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  // Липсващ ключ е грешка в настройките, не паднал доставчик — не се повтаря.
  let key: string;
  try {
    key = apiKey();
  } catch (error) {
    throw new ProviderError(
      'PROVIDER_AUTH',
      error instanceof Error ? error.message : 'Липсва FAL_API_KEY',
      false,
    );
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Key ${key}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ProviderError(
      'PROVIDER_UNAVAILABLE',
      `fal.ai не отговори: ${error instanceof Error ? error.message : String(error)}`,
      true,
    );
  }

  if (!response.ok) {
    throw classify(response.status, await response.text().catch(() => ''));
  }

  return (await response.json()) as T;
}

export class FalImageAppsV2 implements TryOnProvider {
  readonly name = 'fal_image_apps_v2' as const;
  readonly costUSD = COST_USD;
  readonly supportsAspectRatio = true;

  async run(input: RunInput): Promise<{ jobId: string }> {
    const data = await request<FalSubmitResponse>(`${QUEUE_BASE}/${MODEL_PATH}`, {
      method: 'POST',
      body: JSON.stringify({
        person_image_url: input.personUrl,
        clothing_image_url: input.garmentUrl,
        preserve_pose: true,
        ...(input.aspectRatio === 'auto' ? {} : { aspect_ratio: input.aspectRatio }),
      }),
    });

    if (!data.request_id) {
      throw new ProviderError(
        'PROVIDER_BAD_REQUEST',
        'fal.ai не върна request_id',
        false,
      );
    }

    return { jobId: data.request_id };
  }

  async poll(jobId: string): Promise<PollResult> {
    const id = encodeURIComponent(jobId);
    const state = await request<FalStatusResponse>(
      `${QUEUE_BASE}/${MODEL_PATH}/requests/${id}/status`,
      { method: 'GET' },
    );

    if (state.status === 'IN_QUEUE' || state.status === 'IN_PROGRESS') {
      return { status: 'pending' };
    }

    if (state.status !== 'COMPLETED') {
      return {
        status: 'failed',
        errorCode: 'PROVIDER_FAILED',
        detail: `fal.ai върна ${state.status ?? 'неизвестно състояние'}`,
      };
    }

    const result = await request<FalResultResponse>(
      `${QUEUE_BASE}/${MODEL_PATH}/requests/${id}`,
      { method: 'GET' },
    );

    const image = result.image?.url ?? result.images?.[0]?.url;
    if (!image) {
      return {
        status: 'failed',
        errorCode: 'PROVIDER_FAILED',
        detail: 'fal.ai каза „готово", но не върна изображение',
      };
    }

    return { status: 'done', imageUrl: image };
  }
}
