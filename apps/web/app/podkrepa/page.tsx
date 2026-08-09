import Link from 'next/link';
import { LegalPage, Section } from '@/components/legal';
import { R } from '@/lib/routes';

/**
 * ПОДДРЪЖКА
 *
 * Засега е адрес за връзка, не система за билети. Таблиците за билети ги
 * има в схемата (`support_tickets`, `support_messages`) и екранът за тях е
 * работа за админ панела — да го направим сега значи да поддържаме кутия,
 * в която никой не гледа.
 *
 * Един работещ имейл е по-добър от красива форма, чиито съобщения отиват
 * никъде.
 */

export const metadata = {
  title: 'Поддръжка · ПРОБВАЙ',
};

const EMAIL = 'zdravey@probvai.bg';

export default function PodkrepaPage() {
  return (
    <LegalPage title="Пиши ни" updated="8 август 2026 г.">
      <p>
        Нещо не работи, имаш въпрос за плащане или искаш данните си — пиши на{' '}
        <a href={`mailto:${EMAIL}`} className="font-semibold text-ink underline underline-offset-2">
          {EMAIL}
        </a>
        . Отговаряме до два работни дни.
      </p>

      <Section title="Преди да пишеш">
        <p>
          Ако проба се е провалила, тя вече ти е върната в баланса — става
          автоматично и не е нужно да го искаш. Провери баланса си.
        </p>
        <p>
          Ако си забравил паролата си, тя се сменя от{' '}
          <Link href={R.forgotPassword} className="underline underline-offset-2">
            екрана за забравена парола
          </Link>{' '}
          с отговора на тайния ти въпрос.
        </p>
      </Section>

      <Section title="Какво да напишеш">
        <p>
          Имейла на профила си и какво точно се случва. Ако е за конкретна
          проба — кога си я направил. Така отговорът идва от първия път.
        </p>
      </Section>

      <Section title="Правното">
        <p>
          <Link href={R.privacy} className="underline underline-offset-2">
            Политика за поверителност
          </Link>{' '}
          ·{' '}
          <Link href={R.terms} className="underline underline-offset-2">
            Условия за ползване
          </Link>
        </p>
      </Section>
    </LegalPage>
  );
}
