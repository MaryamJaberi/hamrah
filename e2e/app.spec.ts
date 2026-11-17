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

  // G15 / S0.1 AC5: a block hides both people from each other's discover, not only the blocker's.
  test('someone who blocked me does not appear in my discover', async ({ browser }) => {
    const tag = Date.now().toString(36);
    const a = await (await browser.newContext()).newPage();
    const b = await (await browser.newContext()).newPage();
    await login(b, `b${tag}`);
    await login(a, `a${tag}`);

    await a.goto('/discover');
    const bOnDiscover = a.getByText(`تست b${tag}`).first();
    // Discover shows the 30 best matches of the 100 newest people; on a crowded test database B may not be among them.
    test.skip(!(await bOnDiscover.isVisible().catch(() => false)), 'B is not among A\'s suggestions on this test database');

    await b.goto('/search');
    await b.getByLabel('عبارت جستجو').fill(`تست a${tag}`);
    await b.getByRole('button', { name: /جستجو/ }).click();
    await b.getByTestId('search-result').first().click();
    await b.getByRole('button', { name: 'گزارش یا مسدود کردن' }).click();
    await b.getByRole('button', { name: /گزارش و مسدود کردن/ }).click();
    await expect(b.getByText('گزارش ثبت و کاربر مسدود شد.')).toBeVisible();

    await a.reload();
    await expect(a.getByRole('heading', { name: 'کشف همراه' })).toBeVisible();
    await expect(a.getByText(`تست b${tag}`)).toHaveCount(0);
  });

  test('regular users cannot open admin', async ({ page }) => {
    await login(page);
    await page.goto('/admin');
    await expect(page).toHaveURL(/discover/);
  });
});
