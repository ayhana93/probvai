/**
 * Прави снимки на екраните на телефонна ширина.
 *
 *   node scripts/shots.mjs [порт] [път,път,...]
 *
 * 393×852 е iPhone 15/16 — базата, на която строим. Ако нещо се чупи на
 * 375px, чупи се и тук.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] ?? '3200';
const paths = (process.argv[3] ?? '/').split(',');
const out = '/tmp/shots';
mkdirSync(out, { recursive: true });

// Средата носи готов Chromium. Ползваме него вместо да сваляме нов —
// версията на Playwright и версията на браузъра не съвпадат по номер,
// но си работят.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 2,
});

for (const path of paths) {
  const name = path === '/' ? 'nachalo' : path.replaceAll('/', '-').slice(1);
  await page.goto(`http://127.0.0.1:${port}${path}`, {
    waitUntil: 'load',
    timeout: 90_000,
  });
  // Оставя шрифтовете и влизащите анимации да седнат.
  // Dev индикаторът на Next стои върху менюто и разваля снимката.
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`✓ ${path} → ${out}/${name}.png`);
}

await browser.close();
