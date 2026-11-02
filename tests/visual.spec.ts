import { test, expect, type Page } from '@playwright/test';

const R = (p: Page, js: string) => p.evaluate(js);
async function boot(page: Page, errors: string[]) {
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => (window as any).__ROOT?.screen() === 'title', null, { timeout: 20_000 });
}

test('title has Hanson Lab link and no console errors', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  await expect(page.locator('a.home')).toHaveAttribute('href', 'https://hansonlab.us');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/test-title-${info.project.name}.png` });
  expect(errors).toEqual([]);
});

for (const mode of ['explicit', 'auto'] as const) {
  test(`plays all 24 levels (${mode} layers)`, async ({ page }) => {
    test.setTimeout(600_000);
    const errors: string[] = [];
    await boot(page, errors);
    const levels: any[] = await R(page, '__ROOT.levels()') as any[];
    expect(levels.length).toBe(24);
    const fails: string[] = [];
    for (const L of levels) {
      await R(page, `__ROOT.load('${L.id}'); __ROOT.skipStory()`);
      for (const s of L.solution) {
        await R(page, mode === 'explicit' ? `__ROOT.place('${s.pegId}', ${s.teeth}, ${s.layer})` : `__ROOT.place('${s.pegId}', ${s.teeth})`);
      }
      const solved = await R(page, '__ROOT.solved()');
      if (!solved) { fails.push(`${L.id}: ${JSON.stringify(await R(page, '__ROOT.placed()'))}`); continue; }
      await page.waitForFunction(() => (window as any).__ROOT.won(), null, { timeout: 20000 });
      expect(await R(page, `__ROOT.stars('${L.id}')`)).toBe(3);
    }
    expect(fails).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('wrong gear does not win, undo and hint work, audio reacts', async ({ page }, info) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.locator('#play-btn').click(); // user gesture unlocks audio
  await page.waitForTimeout(600);
  await page.screenshot({ path: `shots/test-story-${info.project.name}.png` });
  for (let i = 0; i < 4 && (await R(page, '__ROOT.screen()')) === 'story'; i++) { await R(page, '__ROOT.skipStory()'); await page.waitForTimeout(300); }
  await R(page, `__ROOT.load('1-2'); __ROOT.skipStory()`);
  const L: any = (await R(page, '__ROOT.levels()') as any[]).find((l: any) => l.id === '1-2');
  await R(page, `__ROOT.place('${L.solution[0].pegId}', 16, 0)`);
  expect(await R(page, '__ROOT.solved()')).toBe(false);
  await R(page, '__ROOT.undo()');
  expect((await R(page, '__ROOT.placed()') as any[]).length).toBe(0);
  await R(page, '__ROOT.hint()');
  for (const s of L.solution) await R(page, `__ROOT.place('${s.pegId}', ${s.teeth}, ${s.layer})`);
  await page.waitForTimeout(1500);
  const a: any = await R(page, '__ROOT.audio()');
  expect(a.theme).toBe('1');
  await page.screenshot({ path: `shots/test-win-${info.project.name}.png` });
  await R(page, '__ROOT.sandbox()');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `shots/test-sandbox-${info.project.name}.png` });
  expect(errors).toEqual([]);
});
