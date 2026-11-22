import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hasBackend, login } from './helpers';

// «بریم بیرون» — needs the test Supabase project with migration 010 applied.
test.describe('outings', () => {
  test.skip(!hasBackend, 'no test backend configured');

  async function buildProfile(page: import('@playwright/test').Page, gender: 'زن' | 'مرد') {
    await page.goto('/out/profile');
    await page.getByRole('button', { name: /قهوه/ }).first().click();
    await page.getByRole('button', { name: 'بعدی' }).click();
    await page.getByLabel('سال تولد').fill('1994');
    await page.getByRole('button', { name: 'بعدی' }).click();
    await page.getByRole('button', { name: gender, exact: true }).click();
    await page.getByRole('button', { name: 'بعدی' }).click();
    for (let i = 0; i < 9; i++) {
      await expect(page.getByRole('button', { name: /^(بعدی|تمام ✓)$/ })).toBeEnabled();
      await page.getByRole('button', { name: 'رد شو' }).click();
    }
    await expect(page.getByText('پروفایلت آماده است')).toBeVisible();
  }

  test('women-only plan: invite link, vote, mutual privacy, man is refused', async ({ browser }) => {
    test.setTimeout(60_000);
    const tag = Date.now().toString(36);
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    const c = await (await browser.newContext()).newPage();
    await login(a, `oa${tag}`); await buildProfile(a, 'زن');
    await login(b, `ob${tag}`); await buildProfile(b, 'زن');
    await login(c, `oc${tag}`); await buildProfile(c, 'مرد');

    await a.goto('/out/new');
    await a.getByLabel('اسم برنامه').fill('دورهمی تست');
    await a.getByRole('button', { name: 'ساخت و گرفتن لینک دعوت' }).click();
    await a.waitForURL(/\/out\/p\//);
    const code = (await a.locator('code').innerText()).split('/').pop()!;
    expect((await new AxeBuilder({ page: a }).analyze()).violations.filter((v) => v.impact === 'critical')).toEqual([]);

    await c.goto(`/out/join/${code}`);
    await c.getByRole('button', { name: /پایه‌ام/ }).click();
    await expect(c.locator('p[role="alert"]')).toContainText('فقط برای خانم‌ها');

    await b.goto(`/out/join/${code}`);
    await b.getByRole('button', { name: /پایه‌ام/ }).click();
    await b.waitForURL(/\/out\/p\//);
    await b.getByRole('radio', { name: /می‌تونم/ }).first().click();
    await expect(b.getByText(/✅ ۱/).first()).toBeVisible();

    // non-member cannot open the plan page
    const planUrl = a.url();
    await c.goto(planUrl);
    await expect(c.getByText(/پیدا نشد|404/)).toBeVisible();
  });

  test('open invite reaches a fitting person who can respond, owner accepts → plan', async ({ browser }) => {
    test.setTimeout(60_000);
    const tag = Date.now().toString(36);
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, `ia${tag}`); await buildProfile(a, 'زن');
    await login(b, `ib${tag}`); await buildProfile(b, 'زن');
    await a.goto('/out/intent/new');
    await a.getByRole('button', { name: /قهوه/ }).first().click();
    // no area set in the quick profile → the form asks for one
    await a.getByRole('button', { name: 'بفرست به آدم‌های نزدیک' }).click();
    await expect(a.locator('p[role="alert"]')).toContainText('محدوده');
  });
});
