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

test('open "بریم بیرون؟" meetup without preset dates + loading previous friends profile', async ({ page }) => {
  test.skip(!hasDb, 'no test backend configured');
  page.on('dialog', (d) => (d.message().includes('واتس') ? d.dismiss() : d.accept()));
  await page.goto('/d');
  // Create open meetup without predetermined dates
  await page.locator('#c_title').fill('بریم بیرون تست e2e');
  await page.locator('#c_go_open').click();
  await expect(page.getByRole('heading', { name: 'آماده است!' })).toBeVisible();
  await page.getByRole('link', { name: /فرم خودم را پر کنم/ }).click();

  await page.locator('#f_name').fill('مهمان');
  await page.locator('#f_next').click();
  await page.locator('[data-k=rotterdam]').click();
  await page.locator('#f_orig_add_sel').selectOption('delft');
  await page.locator('#f_orig_rad_chk').uncheck();
  await page.locator('#f_next').click();
  await page.locator('[data-mode=ov]').click();
  await page.locator('#f_next').click();

  // In open mode, pick free day/time windows and link a location to a time
  await page.locator('[data-fwin="sat:evening"]').click();
  await page.locator('[data-fwin="sun:afternoon"]').click();
  await page.locator('#f_av_tl_toggle').click();
  await page.locator('#f_av_tl_when').selectOption('wknd');
  await page.locator('#f_av_tl_city').selectOption('delft');
  await page.locator('#f_av_tl_add').click();
  await page.locator('#f_next').click();
  for (let i = 0; i < 5; i++) await page.locator('#f_next').click();
  await expect(page.getByRole('heading', { name: /آماده است/ })).toBeVisible();
  await page.locator('#f_next').click();

  await expect(page.getByText(/بهترین بازه‌های زمانی مشترک/)).toBeVisible();
  await expect(page.getByText(/شنبه عصر/)).toBeVisible();

  await page.locator('[data-tab=share]').click();
  await page.locator('#a_delete').click();
  await expect(page).toHaveURL(/\/d$/);
});

test('creator: expiry date, edit details, archive/unarchive, and delete', async ({ page }) => {
  test.skip(!hasDb, 'no test backend configured');
  page.on('dialog', (d) => (d.message().includes('واتس') ? d.dismiss() : d.accept()));
  await page.goto('/d');
  await page.locator('#c_title').fill('ایونت تست مدیریت');
  await page.locator('#c_org').fill('مریم تست');
  await page.locator('#c_go_open').click();
  await expect(page.getByRole('heading', { name: 'آماده است!' })).toBeVisible();

  // Go to result page with admin token
  const url = page.url();
  const codeMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  expect(codeMatch).toBeTruthy();
  const code = codeMatch![1];
  const urlObj = new URL(url);
  const adminToken = urlObj.searchParams.get('admin');
  expect(adminToken).toBeTruthy();

  await page.goto(`/d/${code}?admin=${adminToken}&tab=share`);
  await expect(page.locator('#a_btn_edit')).toBeVisible();

  // Edit title and note
  await page.locator('#a_btn_edit').click();
  await expect(page.locator('#a_edit_box')).toBeVisible();
  await page.locator('#ae_title').fill('ایونت تست ویرایش‌شده');
  await page.locator('#ae_save').click();
  await expect(page.getByText('تغییرات ذخیره شد')).toBeVisible();
  await expect(page.getByText('ایونت تست ویرایش‌شده')).toBeVisible();

  // Archive meetup
  await page.locator('[data-tab=share]').click();
  await page.locator('#a_btn_archive').click();
  await expect(page.getByText(/این دورهمی آرشیو شده است/)).toBeVisible();

  // Unarchive meetup
  await page.locator('#a_btn_archive').click();
  await expect(page.getByText('دورهمی فعال شد')).toBeVisible();

  // Delete meetup
  await page.locator('#a_delete').click();
  await expect(page).toHaveURL(/\/d$/);
});
