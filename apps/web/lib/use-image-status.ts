'use client';

import * as React from 'react';

/**
 * Разбира дали една картинка се е заредила — включително когато е
 * гръмнала ПРЕДИ React да е закачил обработчика си.
 *
 * ═══ ЗАЩО `onError` НЕ СТИГА ═══
 *
 * Браузърът тръгва да тегли картинката още докато чете HTML-а от сървъра.
 * Ако адресът върне 404, събитието `error` се случва преди хидратацията и
 * React никога не го чува — на екрана остава счупена иконка и празно място
 * в оформлението.
 *
 * Затова освен `onError` проверяваме и в ефект: `complete` е `true`, а
 * `naturalWidth` е нула само когато тегленето е приключило неуспешно.
 */
export function useImageStatus(): {
  ref: React.RefObject<HTMLImageElement | null>;
  failed: boolean;
  onError: () => void;
} {
  const ref = React.useRef<HTMLImageElement | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const image = ref.current;
    if (!image) return;
    if (image.complete && image.naturalWidth === 0) {
      setFailed(true);
    }
  }, []);

  return { ref, failed, onError: () => setFailed(true) };
}
