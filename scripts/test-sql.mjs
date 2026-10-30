import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

try { process.loadEnvFile?.('.env.local'); } catch { /* ignore in CI */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey || url.includes('example.supabase.co') || serviceKey === 'placeholder') {
  console.log('[test:sql] skipped (no test Supabase backend configured)');
  process.exit(0);
}

export const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const createdUserIds = [];

export async function createTestUser(name = 'کاربر تست') {
  const tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `sql-${tag}@e2e.hamrah.invalid`;
  const password = `Pass-${tag}-123!`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.equal(createErr, null, `createUser failed: ${createErr?.message}`);
  const userId = created.user.id;
  createdUserIds.push(userId);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  assert.equal(signErr, null, `signInWithPassword failed: ${signErr?.message}`);

  const { error: profErr } = await client.from('profiles').insert({
    id: userId,
    name,
    city: 'روتردام',
    avatar: '🙂',
    interests: ['زبان', 'پروژه'],
    teach_langs: ['فارسی'],
    learn_langs: ['هلندی'],
    mode: 'both',
  });
  assert.equal(profErr, null, `insert profile failed: ${profErr?.message}`);

  return { id: userId, email, client };
}

async function cleanup() {
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => null);
  }
}

async function main() {
  const dir = path.join(process.cwd(), 'supabase', 'tests');
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()
    : [];
  let passed = 0;
  try {
    for (const file of files) {
      console.log(`▶ ${file}`);
      const mod = await import(pathToFileURL(path.join(dir, file)).href);
      if (typeof mod.run === 'function') {
        await mod.run({ admin, createTestUser, assert });
      }
      console.log(`✓ ${file}`);
      passed++;
    }
    console.log(`\nAll ${passed} SQL test suite(s) passed.`);
  } finally {
    await cleanup();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('✗ SQL test failed:', err);
    process.exit(1);
  });
}
