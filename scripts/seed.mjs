// Seeds demo users so «کشف» and «منتورها» aren't empty. Usage: npm run seed
// Also: SEED_ADMIN_EMAIL=you@example.com npm run seed  → makes that existing account an admin.
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const people = [
  { name: 'سارا', city: 'روتردام', avatar: '👩‍🎨', bio: 'طراح گرافیک؛ دنبال کسی که با هم توی کافه پروژه بزنیم.', interests: ['پروژه', 'هنر'], teach_langs: ['فارسی'], learn_langs: ['هلندی'], mode: 'both' },
  { name: 'امیرحسین', city: 'آنلاین', avatar: '🧑‍💻', bio: 'برنامه‌نویس؛ دنبال همراه برای دیپ‌ورک صبحگاهی.', interests: ['برنامه‌نویسی', 'پروژه', 'استارتاپ'], teach_langs: ['انگلیسی'], learn_langs: ['ژاپنی'], mode: 'online' },
  { name: 'مینا', city: 'تهران', avatar: '🧑‍🎓', bio: 'داوطلب ارشد؛ صبح‌ها کتابخانه.', interests: ['درس خواندن', 'کتاب'], teach_langs: ['فارسی'], learn_langs: ['انگلیسی'], mode: 'both' },
  { name: 'Lotte', city: 'روتردام', avatar: '🚲', bio: 'Ik wil Perzisch leren; ik help je graag met Nederlands.', interests: ['زبان', 'سفر'], teach_langs: ['هلندی', 'انگلیسی'], learn_langs: ['فارسی'], mode: 'inperson' },
  { name: 'علی', city: 'آمستردام', avatar: '🏇', bio: 'دو ساله اسب‌سواری می‌کنم؛ تازه‌کارها بیاید با هم بریم.', interests: ['اسب‌سواری', 'ورزش'], teach_langs: ['فارسی'], learn_langs: ['هلندی'], mode: 'inperson' },
  { name: 'نگار', city: 'آنلاین', avatar: '🧘', bio: 'منتور مدیریت زمان و عادت‌سازی.', interests: ['بهره‌وری', 'منتورشیپ', 'یوگا'], teach_langs: ['فارسی', 'انگلیسی'], learn_langs: [], mode: 'online',
    mentor: { is_mentor: true, mentor_price: 0, mentor_currency: 'usd', mentor_bio: 'هفته‌ای یک جلسه برای برنامه‌ریزی و پیگیری.', mentor_topics: ['مدیریت زمان', 'عادت‌سازی'] } },
  { name: 'رضا', city: 'آنلاین', avatar: '🎓', bio: 'پروداکت منیجر؛ منتور ورود به حوزه محصول.', interests: ['استارتاپ', 'منتورشیپ'], teach_langs: ['فارسی', 'انگلیسی'], learn_langs: [], mode: 'online',
    mentor: { is_mentor: true, mentor_price: 3000, mentor_currency: 'eur', mentor_bio: 'مصاحبه‌های محصول، رزومه، اولین ۹۰ روز.', mentor_topics: ['مدیریت محصول', 'رزومه', 'مصاحبه'] } },
];

for (const [i, p] of people.entries()) {
  const email = `demo${i + 1}@demo.hamrah.invalid`;
  let { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error && !/already/i.test(error.message)) throw error;
  const id = data?.user?.id ?? (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find((u) => u.email === email)?.id;
  const { mentor, ...base } = p;
  const { error: e } = await db.from('profiles').upsert({ id, ...base, ...(mentor ?? {}) });
  if (e) throw e;
  console.log('✓', p.name);
}

if (process.env.SEED_ADMIN_EMAIL) {
  const u = (await db.auth.admin.listUsers({ perPage: 1000 })).data.users.find((x) => x.email === process.env.SEED_ADMIN_EMAIL);
  if (!u) console.warn('admin email not found — sign in once first');
  else { await db.from('profiles').update({ is_admin: true }).eq('id', u.id); console.log('✓ admin:', u.email); }
}
