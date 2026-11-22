import Link from 'next/link';
import { getSession } from '@/lib/supabase/server';
import { activityIcon, faDateTime, faNum } from '@/lib/outings';
import JoinInvite from './JoinInvite';

export const dynamic = 'force-dynamic';

export default async function OutHub() {
  const { supabase, user } = await getSession();
  const [{ data: op }, { data: mems }, { data: myIntents }, { data: nearby }, { data: dhMine }] = await Promise.all([
    supabase.from('outing_profiles').select('builder_step,activities').eq('user_id', user!.id).maybeSingle(),
    supabase.from('outing_plan_members').select('status, role, outing_plans(id,title,status,invite_code,activity_options,chosen_slot,created_at)')
      .eq('user_id', user!.id).in('status', ['joined', 'invited']),
    supabase.from('outing_intents').select('id,title,activity,status,starts_after,starts_before').eq('user_id', user!.id)
      .neq('status', 'closed').gt('starts_before', new Date().toISOString()).order('starts_after'),
    supabase.rpc('nearby_outing_intents'),
    supabase.rpc('dh_my_meetups'),
  ]);
  const meetups = ((dhMine as any[] | null) ?? []).slice(0, 8);
  const plans = (mems ?? []).map((m: any) => ({ ...m.outing_plans, my_status: m.status, my_role: m.role }))
    .filter((p: any) => p.id && p.status !== 'cancelled' && p.status !== 'done');
  const invited = plans.filter((p: any) => p.my_status === 'invited');
  const joined = plans.filter((p: any) => p.my_status === 'joined');
  const near = (nearby as any[] | null) ?? [];
  const profileDone = (op?.builder_step ?? 0) >= 99;

  return (
    <main className="page">
      <h1 className="h1">بریم بیرون 🌆</h1>

      {!profileDone && (
        <Link href="/out/profile" className="card mb-4 flex items-center gap-3 border-2 border-primary-soft">
          <span className="text-3xl" aria-hidden>💬</span>
          <span className="flex-1">
            <b className="block text-sm">چند تا سؤال کوتاه، بعد بهت آدم و جا پیشنهاد می‌دم</b>
            <span className="text-xs text-muted">{op ? 'ادامهٔ پروفایل' : 'ساخت پروفایل بیرون‌رفتن'} · هر چیزی را می‌توانی پنهان نگه داری</span>
          </span>
          <span aria-hidden>←</span>
        </Link>
      )}

      <Link href="/d" className="card mb-3 flex items-center gap-3 border-2 border-accent-soft">
        <span className="text-3xl" aria-hidden>🔗</span>
        <span className="flex-1">
          <b className="block text-sm">دورهمی با یک لینک</b>
          <span className="text-xs text-muted">لینک را در گروه واتس‌اپ بفرست؛ بقیه بدون ثبت‌نام فرم پر می‌کنند و منصفانه‌ترین شهر، روز و جا پیدا می‌شود</span>
        </span>
        <span aria-hidden>←</span>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/out/new" className="card text-center py-5">
          <span className="text-3xl block" aria-hidden>👯‍♀️</span>
          <b className="text-sm block mt-1">برنامه با دوستام</b>
          <span className="text-[11px] text-muted">روز و جا را با هم انتخاب کنید</span>
        </Link>
        <Link href="/out/intent/new" className="card text-center py-5">
          <span className="text-3xl block" aria-hidden>☕</span>
          <b className="text-sm block mt-1">دنبال همراه</b>
          <span className="text-[11px] text-muted">«یکی برای قهوه با این مشخصات»</span>
        </Link>
        <Link href="/out/people" className="card text-center py-4">
          <span className="text-2xl block" aria-hidden>🧭</span><b className="text-sm">آدم‌های هم‌سلیقه</b>
        </Link>
        <Link href="/out/profile" className="card text-center py-4">
          <span className="text-2xl block" aria-hidden>🪪</span><b className="text-sm">پروفایل و حریم خصوصی</b>
        </Link>
      </div>

      <JoinInvite />

      {invited.length > 0 && <>
        <h2 className="section">دعوت‌شده‌ای 💌</h2>
        {invited.map((p: any) => (
          <div key={p.id} className="card mb-2 flex items-center gap-3">
            <span className="flex-1 text-sm font-bold">{p.title}</span>
            <Link className="btn btn-sm" href={`/out/join/${p.invite_code}`}>ببین و بپیوند</Link>
          </div>
        ))}
      </>}

      {meetups.length > 0 && <>
        <h2 className="section">دورهمی‌های من 🔗</h2>
        {meetups.map((m: any) => (
          <Link key={m.code} href={`/d/${m.code}?tab=result`} className="card mb-2 flex items-center gap-3">
            <span className="text-2xl" aria-hidden>{m.final ? '✅' : '🗳️'}</span>
            <span className="flex-1">
              <b className="text-sm block">{m.title}</b>
              <span className="text-xs text-muted">{faNum(m.count)} جواب{m.is_admin ? ' · برگزارکننده' : ''}{m.final ? ' · قطعی شده' : ''}</span>
            </span>
            <span aria-hidden>←</span>
          </Link>
        ))}
      </>}

      <h2 className="section">برنامه‌های من</h2>
      {joined.length === 0 && <div className="card text-center text-sm text-muted py-6">هنوز برنامه‌ای نداری. یکی بساز و لینکش را برای دوستات بفرست 🌿</div>}
      {joined.map((p: any) => (
        <Link key={p.id} href={`/out/p/${p.id}`} className="card mb-2 flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{activityIcon(p.activity_options?.[0] ?? '')}</span>
          <span className="flex-1">
            <b className="text-sm block">{p.title}</b>
            <span className="text-xs text-muted">{p.status === 'confirmed' ? '✅ قطعی شده' : '🗳️ در حال رأی‌گیری'}{p.my_role === 'organizer' ? ' · برگزارکننده' : ''}</span>
          </span>
          <span aria-hidden>←</span>
        </Link>
      ))}

      {(myIntents ?? []).length > 0 && <>
        <h2 className="section">دعوت‌های باز من</h2>
        {(myIntents ?? []).map((i) => (
          <Link key={i.id} href={`/out/i/${i.id}`} className="card mb-2 block">
            <b className="text-sm">{activityIcon(i.activity)} {i.title}</b>
            <span className="text-xs text-muted block">{faDateTime(i.starts_after)} · {i.status === 'open' ? 'باز' : 'جور شد'}</span>
          </Link>
        ))}
      </>}

      <h2 className="section">نزدیکت، دنبال همراه می‌گردند</h2>
      {near.length === 0 && <div className="card text-center text-sm text-muted py-6">فعلاً دعوتی که به تو بخورد نیست. {profileDone ? '' : 'با کامل کردن پروفایل، پیشنهادهای بیشتری می‌بینی.'}</div>}
      {near.map((i) => (
        <Link key={i.id} href={`/out/i/${i.id}`} className="card mb-2 flex items-center gap-3">
          <span className="text-2xl" aria-hidden>{i.by?.avatar ?? '🙂'}</span>
          <span className="flex-1 min-w-0">
            <b className="text-sm block truncate">{activityIcon(i.activity)} {i.title}</b>
            <span className="text-xs text-muted">{i.by?.name} · {faDateTime(i.starts_after)}{i.area_label ? ` · ${i.area_label}` : ''}</span>
            {typeof i.by?.score === 'number' && <span className="text-[11px] text-accent block">هم‌خوانی {faNum(i.by.score)}٪</span>}
          </span>
          {i.my_response && <span className="chip chip-accent">اعلام آمادگی کردی</span>}
        </Link>
      ))}
    </main>
  );
}
