/**
 * ПРОФИЛЪТ НА ВЛЕЗЛИЯ ЧОВЕК
 *
 * Един хук, един източник. Преди всеки екран си вадеше баланса сам и на
 * два екрана се виждаха две различни числа — това е по-лошо от липсващо
 * число, защото подкопава доверието към всички останали.
 *
 * ═══ ЗАЩО НЕ СЕ ЗАРЕЖДА ПРИ ВСЯКО ПОКАЗВАНЕ ═══
 *
 * Профилът стои на почти всеки екран и тръгваше от нула при всяко натискане
 * в долното меню: скелет вместо баланс, после число. Едно и също число,
 * показано и скрито три пъти за минута, кара приложението да изглежда бавно,
 * макар заявката да е бърза.
 *
 * Сега последното известно се показва ВЕДНАГА, а сървърът се пита тихо
 * отзад. Разлика се вижда само когато наистина има разлика.
 */

'use client';

import * as React from 'react';
import { readCache, writeCache } from '@/lib/cache';

export type Me = {
  id: string;
  email: string;
  name: string | null;
  credits: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasDefaultPhoto: boolean;
  hasAvatar: boolean;
  memberSince: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    phone: string | null;
    age: number | null;
    wardrobePublic: boolean;
    completed: boolean;
  };
  tier: {
    xp: number;
    rank: string;
    rankNote: string;
    emoji: string;
    next: string | null;
    toNext: number;
    progressPct: number;
    vip: boolean;
    spentEur: string;
    toVipEur: string;
  };
};

const KEY = 'me';

export function useMe() {
  const cached = readCache<Me>(KEY);

  const [me, setMe] = React.useState<Me | null>(cached ?? null);
  // „Зареждам" значи „нямам какво да покажа". Има ли запомнено, няма
  // зареждане — има обновяване, а то не бива да се вижда.
  const [loading, setLoading] = React.useState(!cached);

  const reload = React.useCallback(async () => {
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      if (response.ok) {
        const fresh = (await response.json()) as Me;
        writeCache(KEY, fresh);
        setMe(fresh);
      }
    } catch {
      // Без мрежа екраните показват каквото имат. Не гърмим.
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { me, loading, reload };
}
