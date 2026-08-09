/**
 * ОБВИВКА НА ПРАВНИТЕ СТРАНИЦИ
 *
 * ═══ ЗАЩО ИЗГЛЕЖДАТ ПО-СКУЧНО ОТ ОСТАНАЛОТО ═══
 *
 * Няма парчета материал, няма наклони, няма маркерни щрихи. Нарочно.
 * Тези страници се четат, а не се разглеждат — и обикновено се четат от
 * човек, който е притеснен за нещо. Украсата там пречи.
 *
 * Единственото, което е взето от езика на приложението, е хартиеният фон и
 * шрифтът. Всичко останало е дълга колона текст с широки редове.
 *
 * ═══ ШИРОЧИНАТА ═══
 *
 * 62 знака на ред, не пълната ширина на екрана. Дългият ред кара окото да
 * търси началото на следващия и четенето се разпада точно на текст, който
 * и без това никой не иска да чете.
 */

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[560px] px-6 pb-20 pt-[max(32px,calc(env(safe-area-inset-top)+16px))]">
      <h1 className="display text-[28px] leading-tight">{title}</h1>
      <p className="mt-2 text-[13px] text-ink-45">Последна промяна: {updated}</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-ink-70 [&_p]:mt-3 [&_p:first-child]:mt-0">
        {children}
      </div>

      <p className="mt-12 text-center text-[13px] text-ink-25">ПРОБВАЙ · probvai.bg</p>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display text-[18px] text-ink">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * Списък с точки. Тирето е нарисувано, а не е `list-style` — нативната
 * точка се подравнява различно в трите браузъра и на дълъг текст личи.
 */
export function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-[9px] size-1.5 shrink-0 rounded-full bg-ink-25" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
