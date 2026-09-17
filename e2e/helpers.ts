import { expect, type Page } from '@playwright/test';

export const hasBackend = !!process.env.E2E_TEST_SECRET && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Signs in a throwaway test user through /api/test/login and completes onboarding if needed. */
export async function login(page: Page, tag = Math.random().toString(36).slice(2, 8)) {
  const email = `u-${tag}@e2e.hamrah.invalid`;
  const res = await page.request.post('/api/test/login', { data: { email }, headers: { 'x-e2e-secret': process.env.E2E_TEST_SECRET! } });
  expect(res.ok()).toBeTruthy();
  const { token_hash } = await res.json();
  await page.goto(`/auth/confirm?token_hash=${token_hash}`);
  await page.waitForURL(/\/(discover|onboarding)/);
  if (page.url().includes('/onboarding')) await onboard(page, `تست ${tag}`);
  return email;
}

export async function onboard(page: Page, name: string) {
  await page.getByLabel('اسم').fill(name);
  await page.getByLabel('شهر').fill('روتردام');
  await page.getByRole('button', { name: 'بعدی' }).click();
  await page.getByRole('button', { name: 'زبان', exact: true }).click();
  await page.getByRole('button', { name: 'پروژه', exact: true }).click();
  await page.getByRole('button', { name: 'بعدی' }).click();
  await page.getByRole('button', { name: 'شروع کنیم' }).click();
  await page.waitForURL(/discover/);
}
