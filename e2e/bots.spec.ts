import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

// Signed-in UI tests as the test bots (bot1…bot8@bot.hamrah.invalid, see supabase/seed/bots.sql).
// They log in with a password straight against Supabase, so no service-role key or e2e secret is needed.
// Run against the TEST database only: BOT_PASSWORD + NEXT_PUBLIC_SUPABASE_* in .env.local.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, PW = process.env.BOT_PASSWORD;
const email = (n: number) => `bot${n}@bot.hamrah.invalid`;

/** Puts bot n's Supabase session into the browser's cookies, exactly as @supabase/ssr would. */
async function botLogin(ctx: BrowserContext, n: number) {
  const jar: { name: string; value: string }[] = [];
  const sb = createServerClient(URL, KEY, { cookies: { getAll: () => jar, setAll: (cs) => cs.forEach((c) => { const i = jar.findIndex((x) => x.name === c.name); if (i >= 0) jar.splice(i, 1); if (c.value) jar.push({ name: c.name, value: c.value }); }) } });
  const { error } = await sb.auth.signInWithPassword({ email: email(n), password: PW! });
  if (error) throw new Error(error.message);
  const base = new globalThis.URL(test.info().project.use.baseURL ?? 'http://localhost:3000');
  await ctx.addCookies(jar.map((c) => ({ name: c.name, value: c.value, domain: base.hostname, path: '/', sameSite: 'Lax' as const })));
}
async function api(n: number) {
  const db = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: email(n), password: PW! });
  if (error) throw error;
  return { db, id: data.user!.id };
}
/** Fails on server errors and on the Next.js crash screen. */
async function visit(page: Page, path: string) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const res = await page.goto(path);
  expect(res?.status(), `${path} status`).toBeLessThan(500);
  await expect(page.getByText(/Application error|Internal Server Error|Unhandled Runtime Error/)).toHaveCount(0);
  await page.waitForLoadState('networkidle').catch(() => {});
  expect(errors, `${path} page errors`).toEqual([]);
}

test.describe('bots', () => {
  test.skip(!PW || !URL, 'BOT_PASSWORD / NEXT_PUBLIC_SUPABASE_* not set');

  let planId = '', intentId = '';
  test.beforeAll(async () => {
    const a = await api(1), b = await api(2);
    const t = new Date(Date.now() + 3 * 864e5).toISOString();
    // reuse today's test plan if there is one (plans are rate-limited to 10 a day per person)
    const { data: old } = await a.db.from('outing_plans').select('id').eq('title', 'تست رابط (بات)').eq('status', 'collecting').order('created_at', { ascending: false }).limit(1);
    const { data: pid, error } = old?.[0] ? { data: old[0].id, error: null } : await a.db.rpc('create_outing_plan', { p_title: 'تست رابط (بات)', p_note: 'از Playwright', p_activities: ['قهوه', 'پیاده‌روی'],
      p_area_label: 'روتردام', p_lat: 51.92, p_lng: 4.48, p_women_only: false, p_max: 8, p_slots: [t] });
    if (error) throw error;
    planId = pid as string;
    const { data: row } = await a.db.from('outing_plans').select('invite_code').eq('id', planId).single();
    await b.db.rpc('join_outing_plan', { p_code: row!.invite_code });
    const { data: oldI } = await b.db.from('outing_intents').select('id').eq('title', 'قهوه تست رابط (بات)').eq('status', 'open').gt('starts_before', new Date().toISOString()).limit(1);
    const { data: iid, error: ie } = oldI?.[0] ? { data: oldI[0].id, error: null } : await b.db.rpc('create_outing_intent', { p_activity: 'قهوه', p_title: 'قهوه تست رابط (بات)', p_after: new Date(Date.now() + 864e5).toISOString(),
      p_before: new Date(Date.now() + 864e5 + 3 * 36e5).toISOString(), p_area_label: 'روتردام', p_lat: 51.91, p_lng: 4.47, p_radius: 15, p_want: {}, p_max: 2 });
    if (ie && !/rate_limited/.test(ie.message)) throw ie;
    intentId = (iid as string) ?? '';
  });

  test('every signed-in page opens without errors', async ({ context, page }) => {
    test.setTimeout(180_000);
    await botLogin(context, 1);
    for (const p of ['/discover', '/search', '/goals', '/sessions', '/chat', '/mentors', '/profile', '/verify',
      '/out', '/out/new', '/out/intent/new', '/out/people', '/out/profile', `/out/p/${planId}`]) {
      await visit(page, p);
      await expect(page, `${p} must not bounce to login`).not.toHaveURL(/\/login/);
    }
  });

  test('outing plan: every tab works and chat reaches the other member live', async ({ browser }) => {
    test.setTimeout(120_000);
    const ca = await browser.newContext(), cb = await browser.newContext();
    await botLogin(ca, 1); await botLogin(cb, 2);
    const a = await ca.newPage(), b = await cb.newPage();
    await visit(a, `/out/p/${planId}`); await visit(b, `/out/p/${planId}`);
    await expect(a.getByText('تست رابط (بات)').first()).toBeVisible();
    for (const tab of ['چی', 'کجا', 'کی‌ها', 'یخ‌شکن', 'کِی']) {
      await a.getByRole('tab', { name: new RegExp(tab) }).first().click();
      await expect(a.getByText(/Application error/)).toHaveCount(0);
    }
    await a.getByRole('tab', { name: /گفتگو/ }).first().click();
    await b.getByRole('tab', { name: /گفتگو/ }).first().click();
    const msg = `سلام از Playwright ${Date.now().toString(36)}`;
    const box = a.getByRole('textbox').last();
    await box.fill(msg); await box.press('Enter');
    await expect(b.getByText(msg)).toBeVisible({ timeout: 15_000 });
    await ca.close(); await cb.close();
  });

  test('open invite page shows to the owner and to a nearby bot', async ({ browser }) => {
    test.skip(!intentId, 'intent rate-limited today');
    const co = await browser.newContext(), cn = await browser.newContext();
    await botLogin(co, 2); await botLogin(cn, 5);
    const o = await co.newPage(), n = await cn.newPage();
    await visit(o, `/out/i/${intentId}`);
    await expect(o.getByText('قهوه تست رابط (بات)').first()).toBeVisible();
    await visit(n, '/out');
    await expect(n.getByText('قهوه تست رابط (بات)').first()).toBeVisible();
    await co.close(); await cn.close();
  });

  test('like-minded people list shows bots with reasons', async ({ context, page }) => {
    await botLogin(context, 1);
    await visit(page, '/out/people');
    await expect(page.locator('.card', { hasText: 'بات' }).first()).toBeVisible();
    await expect(page.getByText(/٪/).first()).toBeVisible();
  });

  test('a stranger cannot open someone else’s plan', async ({ context, page }) => {
    await botLogin(context, 6);
    await visit(page, `/out/p/${planId}`);
    await expect(page.getByText('از Playwright')).toHaveCount(0);
  });
});
