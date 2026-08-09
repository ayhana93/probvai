/**
 * Съдържанието на изходящите писма. Всичко на български.
 *
 * Нарочно без изображения и без външни ресурси — писмо, което зарежда нещо
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
    Ако това писмо не е за теб, просто го изтрий.
  </div>
</body>
</html>`;
}

export function magicLinkEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: 'Влез в ПРОБВАЙ',
    html: shell(
      'Влез с едно натискане',
      `<p style="margin:0 0 24px;color:#48484a">Връзката е валидна 24 часа и работи само веднъж.</p>
       <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600">Влез в ПРОБВАЙ</a>
       <p style="margin:24px 0 0;font-size:13px;color:#8e8e93">Ако бутонът не работи, копирай този адрес:<br>
       <span style="word-break:break-all">${url}</span></p>`,
    ),
    text: `Влез в ПРОБВАЙ\n\nОтвори тази връзка, за да влезеш:\n${url}\n\nВалидна е 24 часа и работи само веднъж.\nАко това писмо не е за теб, просто го изтрий.`,
  };
}
