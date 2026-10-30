import { test, expect } from '@playwright/test';
import { hasBackend, login } from './helpers';

// These need a Supabase test project: set NEXT_PUBLIC_SUPABASE_* , SUPABASE_SERVICE_ROLE_KEY and E2E_TEST_SECRET.
test.describe('signed-in flows', () => {
  test.skip(!hasBackend, 'no test backend configured');

  test('onboarding lands on discover with a seeded goal', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: 'کشف همراه' })).toBeVisible();
    await page.getByRole('link', { name: /هدف‌ها/ }).click();
    await expect(page.getByText('تمرین زبان')).toBeVisible();
  });

  test('create a goal and log progress', async ({ page }) => {
    await login(page);
    await page.goto('/goals');
    await page.getByRole('button', { name: '＋ هدف جدید' }).click();
    await page.getByLabel('می‌خوام…').fill('گیتار یاد بگیرم');
    await page.getByRole('button', { name: 'ساخت هدف' }).click();
    const card = page.locator('.card', { hasText: 'گیتار یاد بگیرم' });
    await card.getByRole('button', { name: /یک قدم جلو رفتم/ }).click();
    await expect(card.getByText('۱۰٪')).toBeVisible();
  });

  test('request → accept → realtime chat', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(b, `b${tag}`);
    await login(a, `a${tag}`);

    await a.goto('/search');
    await a.getByLabel('عبارت جستجو').fill(`تست b${tag}`);
    await a.getByRole('button', { name: /جستجو/ }).click();
    await a.getByTestId('search-result').first().click();
    await a.getByRole('button', { name: 'درخواست اتصال' }).click();
    await a.getByRole('button', { name: 'ارسال' }).click();
    await expect(a.getByText(/در انتظار پاسخ/)).toBeVisible();

    await b.goto('/discover');
    await b.getByRole('button', { name: 'قبول و شروع گفتگو' }).click();
    await b.waitForURL(/\/chat\//);
    await b.getByLabel('پیام').fill('سلام از تست');
    await b.getByRole('button', { name: 'ارسال' }).click();
    await expect(b.getByText('سلام از تست')).toBeVisible();

    await a.goto('/chat');
    await a.getByRole('link', { name: new RegExp(`تست b${tag}`) }).click();
    await expect(a.getByText('سلام از تست')).toBeVisible(); // realtime or initial load
  });

  test('regular users cannot open admin', async ({ page }) => {
    await login(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/discover/);
  });

  test('onboarding shows friendly error instead of raw DB error text (AC4)', async ({ page }) => {
    const tag = `err-${Date.now().toString(36)}`;
    const email = `u-${tag}@e2e.hamrah.invalid`;
    const res = await page.request.post('/api/test/login', {
      data: { email },
      headers: { 'x-e2e-secret': process.env.E2E_TEST_SECRET! },
    });
    expect(res.ok()).toBeTruthy();
    const { token_hash } = await res.json();
    await page.goto(`/auth/confirm?token_hash=${token_hash}`);
    await page.waitForURL(/\/onboarding/);

    await page.route('**/rest/v1/profiles*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'new row for relation "profiles" violates check constraint', code: '23514' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByLabel('اسم').fill(`تست ${tag}`);
    await page.getByLabel('شهر').fill('روتردام');
    await page.getByRole('button', { name: 'بعدی' }).click();
    await page.getByRole('button', { name: 'زبان', exact: true }).click();
    await page.getByRole('button', { name: 'پروژه', exact: true }).click();
    await page.getByRole('button', { name: 'بعدی' }).click();
    await page.getByRole('button', { name: 'شروع کنیم' }).click();

    await expect(page.locator('p[role="alert"]')).toHaveText('ذخیره نشد، دوباره امتحان کن');
    await expect(page.getByText(/violates check constraint/)).toHaveCount(0);
  });

  test('if B blocked A, B does not appear in A discover (AC5 / G15)', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(a, `a-blk-${tag}`);
    await login(b, `b-blk-${tag}`);

    // Before block: A sees B on /discover
    await a.goto('/discover');
    await expect(a.getByText(`تست b-blk-${tag}`)).toBeVisible();

    // B opens A's profile from /discover and blocks A
    await b.goto('/discover');
    await b.getByRole('link', { name: new RegExp(`تست a-blk-${tag}`) }).first().click();
    await b.waitForURL(/\/u\//);
    await b.getByRole('button', { name: 'گزارش یا مسدود کردن' }).click();
    await b.getByRole('button', { name: new RegExp(`گزارش و مسدود کردن تست a-blk-${tag}`) }).click();
    await expect(b.getByText('گزارش ثبت و کاربر مسدود شد.')).toBeVisible();

    // After B blocks A: B does not appear in A's /discover
    await a.goto('/discover');
    await expect(a.getByText(`تست b-blk-${tag}`)).toHaveCount(0);
  });
});
