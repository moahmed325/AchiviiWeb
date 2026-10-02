import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto('http://localhost:5199/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const rows = await page.evaluate(() => [...document.querySelectorAll('main > *')].map((el) => ({ id: el.id || el.getAttribute('aria-label') || el.className.slice(0, 20), h: Math.round(el.getBoundingClientRect().height) })));
console.log(rows.map((r) => `${String(r.h).padStart(5)}px  ${r.id}`).join('\n'));
// sticky bar at the final CTA, waiting out smooth scrolling
await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.getElementById('start')?.scrollIntoView(); });
await page.waitForTimeout(1500);
console.log('sticky visible at final CTA:', await page.locator('text=Begin your 90 days').isVisible());
await page.evaluate(() => window.scrollTo(0, 2000));
await page.waitForTimeout(1200);
console.log('sticky visible mid-page:', await page.locator('text=Begin your 90 days').isVisible());
await browser.close();
