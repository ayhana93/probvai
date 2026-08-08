/**
 * ПРОФИЛЪТ НА ВЛЕЗЛИЯ ЧОВЕК
 *
 * Един хук, един източник. Преди всеки екран си вадеше баланса сам и на
 * два екрана се виждаха две различни числа — това е по-лошо от липсващо
 * число, защото подкопава доверието към всички останали.
 */

'use client';

import * as React from 'react';

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

export function useMe() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    try {
      const response = await fetch('/api/me', { cache: 'no-store' });
      if (response.ok) setMe((await response.json()) as Me);
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
