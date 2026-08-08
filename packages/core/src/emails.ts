/**
 * Писма, които тръгват от сървърната част.
 *
 * Тук е потвърждението за покупка. Писмата около входа живеят в
 * `apps/web/lib/emails.ts`, защото ги вика Auth.js — те не минават оттук.
 *
 * Нарочно без изображения и без външни ресурси: писмо, което зарежда нещо
 * отвън, попада в спам по-често и издава на подателя кога е отворено.
 */

const BRAND = '#1c1c1e';

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="bg">
<body style="margin:0;padding:24px;background:#f5f5f7;font:16px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND}">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <div style="font-size:14px;letter-spacing:.14em;color:#8e8e93;margin-bottom:20px">ПРОБВАЙ</div>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
    ${body}
  </div>
  <div style="max-width:480px;margin:16px auto 0;text-align:center;font-size:12px;color:#8e8e93">
    Това писмо е потвърждение за покупка. Пази го.
  </div>
</body>
</html>`;
}

export type PurchaseEmail = { subject: string; html: string; text: string };

/**
 * Потвърждението след плащане.
 *
 * Праща се СЛЕД като кредитите са влезли, не преди. Писмо „купи 50 кредита",
 * последвано от баланс без тях, ражда билет в поддръжката за всяка покупка.
 *
 * Носи и трите числа, които човек проверява: колко кредита, колко пари и
 * какъв е балансът сега. Липсва ли някое, следва имейл с въпрос.
 */
export function purchaseEmail(options: {
  credits: number;
  amountEur: string;
  balance: number;
  appUrl: string;
}): PurchaseEmail {
  const { credits, amountEur, balance, appUrl } = options;

  return {
    subject: `Заредени са ${credits} кредита`,
    html: shell(
      'Плащането мина',
      `<p style="margin:0 0 20px;color:#48484a">
         Заредихме <strong>${credits} кредита</strong> за <strong>€${amountEur}</strong>.
         Балансът ти сега е <strong>${balance}</strong>.
       </p>
       <p style="margin:0 0 24px;color:#48484a">
         От сега нататък пробите ти излизат без воден знак — и старите, и новите.
       </p>
       <a href="${appUrl}/proba" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600">Пробвай нещо</a>
       <p style="margin:24px 0 0;font-size:13px;color:#8e8e93">
         Кредитите не изтичат. Един кредит е една проба.
       </p>`,
    ),
    text: [
      'Плащането мина',
      '',
      `Заредихме ${credits} кредита за €${amountEur}.`,
      `Балансът ти сега е ${balance}.`,
      '',
      'От сега нататък пробите ти излизат без воден знак.',
      `${appUrl}/proba`,
      '',
      'Кредитите не изтичат. Един кредит е една проба.',
    ].join('\n'),
  };
}
