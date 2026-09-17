import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// These run without a backend.
test('unauthenticated users are sent to login', async ({ page }) => {
  await page.goto('/discover');
  await expect(page).toHaveURL(/\/login/);
});

test('login: email button enables only for a valid email', async ({ page }) => {
  await page.goto('/login');
  const send = page.getByRole('button', { name: 'ارسال کد' });
  await expect(send).toBeDisabled();
  await page.getByLabel('ایمیل').fill('nope');
  await expect(send).toBeDisabled();
  await page.getByLabel('ایمیل').fill('me@example.com');
  await expect(send).toBeEnabled();
});

test('login: can switch to phone', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('tab', { name: 'شماره موبایل' }).click();
  await expect(page.getByLabel('شماره موبایل')).toBeVisible();
});

test('login page has no serious a11y violations', async ({ page }) => {
  await page.goto('/login');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('protected API routes reject anonymous calls', async ({ request }) => {
  for (const path of ['/api/notify', '/api/push/subscribe', '/api/payments/stripe/checkout', '/api/admin/users']) {
    const res = await request.post(path, { data: {} });
    expect(res.status(), path).toBe(401);
  }
  expect((await request.post('/api/test/login', { data: {} })).status()).toBe(404);
});

test('stripe webhook rejects unsigned payloads', async ({ request }) => {
  const res = await request.post('/api/payments/stripe/webhook', { data: '{}' });
  expect(res.status()).toBeGreaterThanOrEqual(400);
});
