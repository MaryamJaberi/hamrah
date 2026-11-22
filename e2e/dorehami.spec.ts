import { test, expect } from '@playwright/test';

// «دورهمی» is public: these run as a guest (no login). They need the test database (NEXT_PUBLIC_SUPABASE_*)
// because creating a meetup writes to it; each test deletes what it created.

test('/d is open to guests, /discover still needs login', async ({ page }) => {
  await page.goto('/d');
  await expect(page).toHaveURL(/\/d$/);
  await expect(page.getByRole('heading', { name: /یک دورهمی بساز/ })).toBeVisible();
  await page.goto('/discover');
  await expect(page).toHaveURL(/\/login/);
});

test('guest: create → answer → result → finalize → delete', async ({ page }) => {
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
