import { test, expect } from '@playwright/test';

// «دورهمی» is public: these run as a guest (no login). They need the test database (NEXT_PUBLIC_SUPABASE_*)
// because creating a meetup writes to it; each test deletes what it created.
const hasDb = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('example.supabase.co');

test('/d is open to guests, /discover still needs login', async ({ page }) => {
  await page.goto('/d');
  await expect(page).toHaveURL(/\/d$/);
  await expect(page.getByRole('heading', { name: /یک دورهمی بساز/ })).toBeVisible();
  await page.goto('/discover');
  await expect(page).toHaveURL(/\/login/);
});

test('guest: create → answer → result → finalize → delete', async ({ page }) => {
  test.skip(!hasDb, 'no test backend configured');
  page.on('dialog', (d) => (d.message().includes('واتس') ? d.dismiss() : d.accept()));
  await page.goto('/d');
  await page.locator('#c_title').fill('دورهمی تست e2e');
  await page.locator('#c_org').fill('تست');
  await page.locator('#c_go').click();
  await expect(page.getByRole('heading', { name: 'آماده است!' })).toBeVisible();
  await page.getByRole('link', { name: /فرم خودم را پر کنم/ }).click();

  await page.locator('#f_name').fill('مهمان');
  await page.locator('#f_next').click();
  await page.locator('[data-k=delft]').click();
  await page.locator('#f_next').click();
  await page.locator('[data-mode=ov]').click();
  await page.locator('#f_next').click();
  for (const el of await page.locator('[data-av$=":yes"]').all()) await el.click();
  await page.locator('#f_next').click();
  // optional steps
  for (let i = 0; i < 5; i++) await page.locator('#f_next').click();
  await expect(page.getByRole('heading', { name: /آماده است/ })).toBeVisible();
  await page.locator('#f_next').click();

  await expect(page.getByRole('heading', { name: /منصفانه‌ترین شهر/ })).toBeVisible();
  await expect(page.getByText('دلفت').first()).toBeVisible();

  await page.locator('[data-tab=share]').click();
  await page.locator('#a_venue').fill('کافه تست');
  await page.locator('#a_go').click();
  await expect(page.getByText('قطعی شد').first()).toBeVisible();

  await page.locator('[data-tab=share]').click();
  await page.locator('#a_delete').click();
  await expect(page).toHaveURL(/\/d$/);
});

test('guest: second meetup remembers answers — name → days → review', async ({ page }) => {
  test.skip(!hasDb, 'no test backend configured');
  page.on('dialog', (d) => (d.message().includes('واتس') ? d.dismiss() : d.accept()));
  const make = async (title: string) => {
    await page.goto('/d');
    await page.locator('#c_title').fill(title);
    await page.locator('#c_go').click();
    await page.getByRole('link', { name: /فرم خودم را پر کنم/ }).click();
  };
  const cleanup = async () => {
    await page.goto(page.url().split('?')[0] + '?tab=share');
    await page.locator('#a_delete').click();
    await expect(page).toHaveURL(/\/d$/);
  };
  // first meetup: full form
  await make('دورهمی اول e2e');
  await page.locator('#f_name').fill('مهمان');
  await page.locator('#f_next').click();
  await page.locator('[data-k=leiden]').click();
  await page.locator('#f_next').click();
  await page.locator('[data-mode=car]').click();
  await page.locator('#f_next').click();
  for (const el of await page.locator('[data-av$=":yes"]').all()) await el.click();
  await page.locator('#f_next').click();
  await page.locator('#f_next').click();               // activities
  await page.locator('[data-diet=vegan]').click();
  for (let i = 0; i < 5; i++) await page.locator('#f_next').click();
  await expect(page.getByRole('heading', { name: /منصفانه‌ترین شهر/ })).toBeVisible();
  await cleanup();

  // second meetup: quick mode
  await make('دورهمی دوم e2e');
  await expect(page.getByText('جواب‌های دفعهٔ قبلت را گذاشتم')).toBeVisible();
  await expect(page.locator('#f_name')).toHaveValue('مهمان');
  await page.locator('#f_next').click();
  await expect(page.locator('[data-av]').first()).toBeVisible();     // straight to the days
  for (const el of await page.locator('[data-av$=":maybe"]').all()) await el.click();
  await page.locator('#f_next').click();
  await expect(page.getByRole('heading', { name: /آماده است/ })).toBeVisible();
  await expect(page.getByText('لایدن')).toBeVisible();
  await expect(page.getByText(/وگان/)).toBeVisible();
  // a section can still be changed from review
  await page.locator('[data-jump=diet]').click();
  await expect(page.locator('[data-diet=vegan]')).toHaveClass(/on/);
  await cleanup();
});
