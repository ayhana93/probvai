/**
 * Избор на активен доставчик по TRYON_PROVIDER.
 *
 * ФАЗА 0: само регистърът. Реализациите се закачат във Фаза 2:
 *   fashn_tryon_max     model_name "tryon-max",  fast, 1K, ~$0.075  ← по подразбиране
 *   fashn_v16           model_name "tryon-v1.6", $0.075
 *   fal_image_apps_v2   fal-ai/image-apps-v2/virtual-try-on, $0.040 ← резервен
 */

import { env } from '../env';
import type { ProviderName, TryOnProvider } from './types';

export * from './types';

type ProviderFactory = () => TryOnProvider;

/** Попълва се във Фаза 2. */
const registry: Partial<Record<ProviderName, ProviderFactory>> = {};

export function registerProvider(name: ProviderName, factory: ProviderFactory): void {
  registry[name] = factory;
}

/** Доставчикът, зададен в TRYON_PROVIDER. */
export function activeProvider(): TryOnProvider {
  const name = env.TRYON_PROVIDER;
  const factory = registry[name];
  if (!factory) {
    throw new Error(
      `Доставчикът "${name}" още не е реализиран. Реализациите идват във Фаза 2.`,
    );
  }
  return factory();
}
