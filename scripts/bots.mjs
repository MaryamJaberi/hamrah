// Test bots for Hamrah: bot1…bot8@bot.hamrah.invalid sign in with a password and use the app's real
// API (Supabase RPCs + RLS) the way people would. Each scenario checks what should and should NOT happen.
//
//   node --env-file=.env.local scripts/bots.mjs            # all scenarios
//   node --env-file=.env.local scripts/bots.mjs outings    # only scenarios whose name contains "outings"
//
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and BOT_PASSWORD (test database only).
// Bots are created by supabase/seed/bots.sql. Never point this at production.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, PW = process.env.BOT_PASSWORD;
if (!URL || !KEY || !PW) { console.error('missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / BOT_PASSWORD'); process.exit(2); }
const only = process.argv[2] ?? '';

const bots = {};
async function bot(n) {
  if (bots[n]) return bots[n];
  const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.signInWithPassword({ email: `bot${n}@bot.hamrah.invalid`, password: PW });
  if (error) throw new Error(`bot${n} login: ${error.message}`);
  return (bots[n] = { db, id: data.user.id, n });
}
const rpc = async (b, fn, args) => { const { data, error } = await b.db.rpc(fn, args); if (error) throw new Error(`${fn} as bot${b.n}: ${error.message}`); return data; };
const rpcErr = async (b, fn, args) => { const { error } = await b.db.rpc(fn, args); return error?.message ?? null; };

let pass = 0, fail = 0; const failures = [];
const ok = (cond, what) => { if (cond) { pass++; console.log('  ✓', what); } else { fail++; failures.push(what); console.log('  ✗', what); } };
const day = (d, h) => { const t = new Date(); t.setUTCDate(t.getUTCDate() + d); t.setUTCHours(h, 0, 0, 0); return t.toISOString(); };

const scenarios = {
  async 'outings: group plan from invite link to confirmed'() {
    const [a, b, c, d, out] = await Promise.all([1, 2, 5, 7, 6].map(bot));
    const plan = await rpc(a, 'create_outing_plan', { p_title: 'قهوهٔ آخر هفته (بات)', p_note: 'تست خودکار', p_activities: ['قهوه', 'صبحانه/برانچ'],
      p_area_label: 'روتردام', p_lat: 51.92, p_lng: 4.48, p_women_only: false, p_max: 8, p_slots: [day(3, 9), day(4, 10)] });
    ok(!!plan, 'آیدا برنامه ساخت');
    const { data: row } = await a.db.from('outing_plans').select('invite_code').eq('id', plan).single();
    const code = row?.invite_code; ok(code?.length === 8, 'لینک دعوت ۸ حرفی دارد');
    const prev = await rpc(out, 'outing_plan_preview', { p_code: code });
    ok(prev?.title && !JSON.stringify(prev).includes('invite_code'), 'پیش‌نمایش لینک فقط اطلاعات عمومی می‌دهد');
    for (const m of [b, c, d]) await rpc(m, 'join_outing_plan', { p_code: code });
    const det = await rpc(b, 'outing_plan_detail', { p_plan: plan });
    ok((det?.members ?? []).filter((m) => m.status === 'joined').length === 4, 'چهار نفر عضو شدند');
    ok(await rpcErr(out, 'outing_plan_detail', { p_plan: plan }) !== null || (await rpc(out, 'outing_plan_detail', { p_plan: plan })) == null, 'غیرعضو جزئیات برنامه را نمی‌بیند');
    const slots = det.slots ?? [];
    for (const m of [a, b, c, d]) await rpc(m, 'vote_outing_slot', { p_slot: slots[0].id, p_answer: m.n === 7 ? 'maybe' : 'yes' });
    await rpc(c, 'vote_outing_slot', { p_slot: slots[1].id, p_answer: 'no' });
    await rpc(b, 'set_outing_activities', { p_plan: plan, p_activities: ['قهوه'] });
    const place = await rpc(b, 'add_outing_place', { p_plan: plan, p_place: { name: 'کافهٔ تست', address: 'Witte de Withstraat', lat: 51.916, lng: 4.474, provider: 'manual', kind: 'cafe' } });
    for (const m of [a, c]) await rpc(m, 'toggle_outing_place_vote', { p_place: place });
    const { error: me } = await c.db.from('outing_messages').insert({ plan_id: plan, sender: c.id, body: 'من شنبه صبح هستم ☕' });
    ok(!me, 'عضو در گفتگوی برنامه پیام می‌دهد');
    const { error: oe } = await out.db.from('outing_messages').insert({ plan_id: plan, sender: out.id, body: 'سلام' });
    ok(!!oe, 'غیرعضو نمی‌تواند در گفتگو پیام بدهد');
    const { error: de } = await b.db.from('outing_plan_slots').insert({ plan_id: plan, starts_at: day(5, 9) });
    ok(!!de, 'نوشتن مستقیم در جدول وقت‌ها بسته است (فقط از راه RPC)');
    ok((await rpcErr(b, 'confirm_outing_plan', { p_plan: plan, p_slot: slots[0].id, p_place: place })) !== null, 'فقط برگزارکننده می‌تواند قطعی کند');
    await rpc(a, 'confirm_outing_plan', { p_plan: plan, p_slot: slots[0].id, p_place: place });
    const fin = await rpc(d, 'outing_plan_detail', { p_plan: plan });
    ok(fin?.plan?.status === 'confirmed' || fin?.status === 'confirmed', 'برنامه قطعی شد و همه می‌بینند');
    const { data: msgs } = await d.db.from('outing_messages').select('body,sender').eq('plan_id', plan);
    ok((msgs ?? []).some((m) => m.sender === null && /قطعی/.test(m.body)), 'پیام سیستمی «قطعی شد» در گفتگو هست');
    return plan;
  },

  async 'outings: privacy of profiles and lifestyle'() {
    const [a, d, out] = await Promise.all([1, 4, 6].map(bot));
    const { data: raw } = await out.db.from('outing_profiles').select('*').eq('user_id', a.id);
    ok((raw ?? []).length === 0, 'هیچ‌کس ردیف پروفایل دیگری را مستقیم نمی‌خواند');
    const { data: rawl } = await out.db.from('outing_lifestyle').select('*').eq('user_id', a.id);
    ok((rawl ?? []).length === 0, 'هیچ‌کس سبک زندگی دیگری را مستقیم نمی‌خواند');
    const card = await rpc(out, 'outing_card', { p_user: a.id });
    ok(card && !('gender' in card), 'کارت پروفایل جنسیت را هرگز نشان نمی‌دهد');
    ok(card && !JSON.stringify(card).includes('places_liked'), 'جاهای محبوب (فقط هم‌برنامه‌ها) به غریبه نشان داده نمی‌شود');
    const ls1 = await rpc(out, 'outing_lifestyle_of', { p_user: a.id });
    ok(!ls1 || Object.keys(ls1).length === 0, 'سبک زندگی به غریبه نشان داده نمی‌شود');
    // aida (bot1) and shima (bot4) both share alcohol "mutual": visible only once they are in the same plan
    const before = await rpc(d, 'outing_lifestyle_of', { p_user: a.id });
    ok(!before?.alcohol, 'دوطرفه: پیش از هم‌برنامه شدن دیده نمی‌شود');
    const plan = await rpc(a, 'create_outing_plan', { p_title: 'بردگیم (بات)', p_note: null, p_activities: ['بردگیم'], p_area_label: 'روتردام', p_lat: 51.92, p_lng: 4.48, p_women_only: true, p_max: 6, p_slots: [day(6, 18)] });
    const { data: row } = await a.db.from('outing_plans').select('invite_code').eq('id', plan).single();
    await rpc(d, 'join_outing_plan', { p_code: row.invite_code });
    const after = await rpc(d, 'outing_lifestyle_of', { p_user: a.id });
    ok(!!after?.alcohol, 'دوطرفه: بعد از هم‌برنامه شدن دیده می‌شود');
    ok((await rpcErr(out, 'join_outing_plan', { p_code: row.invite_code })) !== null, 'مرد به برنامهٔ «فقط خانم‌ها» راه ندارد');
    ok((await rpcErr(out, 'outing_score', { a: a.id, b: d.id })) !== null || (await rpcErr(out, 'outing_intent_candidates', {})) !== null, 'تابع‌های داخلی امتیازدهی بسته‌اند');
  },

  async 'outings: open invite → nearby bots → accept → plan'() {
    const [n, p, s, k] = await Promise.all([2, 5, 7, 6].map(bot));
    const intent = await rpc(n, 'create_outing_intent', { p_activity: 'قهوه', p_title: 'قهوه و حرف زدن به هلندی (بات)', p_after: day(1, 14), p_before: day(1, 17),
      p_area_label: 'روتردام', p_lat: 51.91, p_lng: 4.47, p_radius: 15, p_want: { women_only: true, age_min: 25, age_max: 40 }, p_max: 2 });
    ok(!!intent, 'نیلوفر دعوت باز ساخت');
    const seenP = (await rpc(p, 'nearby_outing_intents', {})) ?? [];
    ok(seenP.some((i) => i.id === intent), 'پریسا (نزدیک، خانم، در بازهٔ سنی) دعوت را می‌بیند');
    const seenK = (await rpc(k, 'nearby_outing_intents', {})) ?? [];
    ok(!seenK.some((i) => i.id === intent), 'کاوه (آمستردام، مرد) دعوت را نمی‌بیند');
    await rpc(p, 'respond_outing_intent', { p_intent: intent, p_message: 'من هستم! ساعت ۳ خوبه؟' });
    await rpc(s, 'respond_outing_intent', { p_intent: intent, p_message: 'منم میام' });
    const det = await rpc(n, 'outing_intent_detail', { p_intent: intent });
    ok((det?.responses ?? []).length === 2, 'صاحب دعوت دو جواب می‌بیند');
    const plan = await rpc(n, 'accept_outing_response', { p_intent: intent, p_user: p.id });
    ok(!!plan, 'با قبول جواب، برنامه ساخته شد');
    const pd = await rpc(p, 'outing_plan_detail', { p_plan: plan });
    ok((pd?.members ?? []).some((m) => m.user_id === p.id || m.id === p.id), 'پریسا عضو برنامه شد');
    ok((await rpcErr(k, 'respond_outing_intent', { p_intent: intent, p_message: 'x' })) !== null, 'کسی که دعوت به او نمی‌خورد نمی‌تواند جواب دهد');
  },

  async 'outings: like-minded matches'() {
    const [a] = await Promise.all([1].map(bot));
    const m = (await rpc(a, 'outing_matches', { p_activity: null, p_limit: 30 })) ?? [];
    ok(m.length > 0, `آیدا ${m.length} آدم هم‌سلیقه می‌بیند`);
    ok(m.every((x) => typeof x.score === 'number' || typeof x.pct === 'number' || x.score != null), 'هر پیشنهاد درصد/امتیاز دارد');
    ok(m.every((x) => !('gender' in x)), 'در فهرست هم‌سلیقه‌ها جنسیت نیست');
  },

  async 'core: request → connection → chat'() {
    const [a, b, k] = await Promise.all([3, 8, 6].map(bot));
    await a.db.from('requests').delete().eq('from_user', a.id).eq('to_user', b.id);
    const { data: rq, error } = await a.db.from('requests').insert({ from_user: a.id, to_user: b.id, message: 'سلام! هفته‌ای یه جلسهٔ کار با هم؟', status: 'pending' }).select('id').single();
    ok(!error, 'ترانه درخواست اتصال فرستاد');
    if (!rq) return;
    ok((await rpcErr(k, 'accept_request', { p_request: rq.id })) !== null, 'نفر سوم نمی‌تواند درخواست دیگران را قبول کند');
    const conn = await rpc(b, 'accept_request', { p_request: rq.id });
    ok(!!conn, 'مهسا قبول کرد و اتصال ساخته شد');
    const { error: e1 } = await b.db.from('messages').insert({ connection_id: conn, sender: b.id, body: 'سلام ترانه 🌿' });
    ok(!e1, 'پیام در چت فرستاده شد');
    const { data: seen } = await k.db.from('messages').select('id').eq('connection_id', conn);
    ok((seen ?? []).length === 0, 'نفر سوم پیام‌های این چت را نمی‌بیند');
    const { error: e2 } = await a.db.from('sessions').insert({ connection_id: conn, host: a.id, planned_min: 50, status: 'planned', starts_at: day(2, 8) });
    ok(!e2, 'ترانه یک جلسه برنامه‌ریزی کرد');
  },
};

// Start clean: every bot leaves (or, as organizer, cancels) the plans left over from earlier runs,
// so "not together yet" checks hold. Plans and invites are rate-limited (10 plans / 3 invites a day per bot);
// to run more often, clear old bot data with supabase/seed/bots-reset.sql on the TEST database.
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const b = await bot(n);
  const { data: ms } = await b.db.from('outing_plan_members').select('plan_id').eq('user_id', b.id).eq('status', 'joined');
  for (const m of ms ?? []) await b.db.rpc('leave_outing_plan', { p_plan: m.plan_id });
}

for (const [name, fn] of Object.entries(scenarios)) {
  if (only && !name.includes(only)) continue;
  console.log(`\n▶ ${name}`);
  try { await fn(); } catch (e) { fail++; failures.push(`${name}: ${e.message}`); console.log('  ✗ خطا:', e.message); }
}
console.log(`\n${pass} درست · ${fail} نادرست`);
if (failures.length) { console.log('\nنادرست‌ها:'); failures.forEach((f) => console.log(' -', f)); }
process.exit(fail ? 1 : 0);
