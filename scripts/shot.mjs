import { chromium } from '@playwright/test';
const [,, w, h, name, ...steps] = process.argv;
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h }, hasTouch: +w < 600, isMobile: +w < 600 });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push(String(e)));
await p.goto(process.env.URL ?? 'http://127.0.0.1:5188/');
try { await p.waitForFunction(() => document.body.dataset.screen === 'title', null, { timeout: 15000 }); } catch { console.log('no title', errs, await p.evaluate(()=>document.body.dataset.screen)); }
for (const s of steps) { await p.evaluate(s); await p.waitForTimeout(900); }
await p.waitForTimeout(1200);
await p.screenshot({ path: `shots/${name}.png` });
console.log('errors', JSON.stringify(errs));
await b.close();
