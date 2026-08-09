/**
 * Избор на активен доставчик по TRYON_PROVIDER.
 *
 *   fashn_tryon_max     model_name "tryon-max",  fast + 1k, $0.075  ← по подразбиране
 *   fashn_v16           model_name "tryon-v1.6", performance, $0.075
 *   fal_image_apps_v2   fal-ai/image-apps-v2/virtual-try-on, $0.040 ← резервен
 *
 * Бизнес логиката никога не вика доставчик директно — само през `activeProvider()`.
 */

import { env } from '../env';
import { FalImageAppsV2 } from './fal-image-apps-v2';
import { FashnTryonMax } from './fashn-tryon-max';
import { FashnV16 } from './fashn-v16';
import type { ProviderName, TryOnProvider } from './types';

export * from './types';
export { FashnTryonMax } from './fashn-tryon-max';
export { FashnV16 } from './fashn-v16';
export { FalImageAppsV2 } from './fal-image-apps-v2';

type ProviderFactory = () => TryOnProvider;

const registry: Partial<Record<ProviderName, ProviderFactory>> = {
  fashn_tryon_max: () => new FashnTryonMax(),
  fashn_v16: () => new FashnV16(),
  fal_image_apps_v2: () => new FalImageAppsV2(),
};

/** Позволява на тестовете да сложат подставка на мястото на истински доставчик. */
export function registerProvider(name: ProviderName, factory: ProviderFactory): void {
  registry[name] = factory;
}

/** Доставчикът, зададен в TRYON_PROVIDER. */
export function activeProvider(): TryOnProvider {
  const name = env.TRYON_PROVIDER;
  const factory = registry[name];
  if (!factory) {
    throw new Error(`Няма реализация за доставчик "${name}".`);
  }
  return factory();
}

/** Доставчик по име — за админ панела и за работника, който чете от базата. */
export function providerByName(name: ProviderName): TryOnProvider {
  const factory = registry[name];
  if (!factory) {
    throw new Error(`Няма реализация за доставчик "${name}".`);
  }
  return factory();
}
