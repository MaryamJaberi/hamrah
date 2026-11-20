'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OutCard from '@/components/OutCard';
import { pickIcebreakers } from '@/lib/icebreakers';
import { activityIcon, directionsLink, errText, faDateTime, faNum, type OutCard as Card, type Place } from '@/lib/outings';

const LeafletMap = dynamic(() => import('@/components/LeafletMap'), { ssr: false, loading: () => <div className="h-[260px] rounded-2xl bg-[#EFEFF6] animate-pulse" /> });

type Slot = { id: string; starts_at: string; yes: number; maybe: number; no: number; mine: 'yes' | 'maybe' | 'no' | null; yes_names: string[] };
type PPlace = Place & { id: string; votes: number; mine: boolean };
type Plan = {
  id: string; title: string; note: string | null; status: string; invite_code: string; organizer: string; is_organizer: boolean;
  activity_options: string[]; area_label: string | null; area_lat: number | null; area_lng: number | null; women_only: boolean; max_people: number;
  chosen_slot: string | null; chosen_place: string | null; members: Card[]; slots: Slot[]; places: PPlace[];
  activity_tally: Record<string, number>; center: { lat: number | null; lng: number | null } | null; venue_hint: Record<string, boolean>;
};
type Msg = { id: string; sender: string | null; body: string; created_at: string };

const TABS = [['when', '🗓️ کِی'], ['what', '✨ چی'], ['where', '📍 کجا'], ['who', '👥 کی‌ها'], ['talk', '💬 یخ‌شکن'], ['chat', '✉️ گفتگو']] as const;
type Tab = (typeof TABS)[number][0];

export default function PlanClient({ plan, me, initialMsgs, appUrl }: { plan: Plan; me: string; initialMsgs: Msg[]; appUrl: string }) {
  const supabase = createClient();
  const router = useRouter();
  const sp = useSearchParams();
  const [tab, setTab] = useState<Tab>(plan.status === 'confirmed' ? 'where' : 'when');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const joined = plan.members.filter((m) => m.status === 'joined');
  const names = useMemo(() => Object.fromEntries(plan.members.map((m) => [m.id, m])), [plan.members]);

  const run = async (fn: () => PromiseLike<{ error: any }>) => {
    setBusy(true); setErr('');
    const { error } = await fn();
    setBusy(false);
    if (error) setErr(errText(error.message)); else router.refresh();
    return !error;
  };

  // ---------- invite ----------
  // origin is read after mount: reading window during render made the server and browser HTML differ
  // (React hydration errors #418/#423/#425) whenever NEXT_PUBLIC_APP_URL is not set
  const [origin, setOrigin] = useState(appUrl || '');
  useEffect(() => { if (!appUrl) setOrigin(window.location.origin); }, [appUrl]);
  const link = `${origin}/out/join/${plan.invite_code}`;
  const [copied, setCopied] = useState(false);
  async function share() {
    const text = `بیا بریم بیرون: «${plan.title}» 🌆\n${link}`;
    if (navigator.share) { try { await navigator.share({ title: plan.title, text, url: link }); return; } catch { /* cancelled */ } }
    await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  // ---------- when ----------
  const best = [...plan.slots].sort((a, b) => b.yes + b.maybe / 2 - (a.yes + a.maybe / 2))[0];
  const [newSlot, setNewSlot] = useState('');

  // ---------- what ----------
  const mine = plan.members.find((m) => m.id === me)?.plan_activities ?? [];
  const [myActs, setMyActs] = useState<string[]>(mine);
  const tally = plan.activity_tally ?? {};
  const topActivity = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] ?? plan.activity_options[0] ?? 'قهوه';

  // ---------- where ----------
  const center = plan.area_lat != null ? { lat: Number(plan.area_lat), lng: Number(plan.area_lng) }
    : plan.center?.lat != null ? { lat: Number(plan.center.lat), lng: Number(plan.center.lng) } : null;
  const [act, setAct] = useState(topActivity);
  const [sugg, setSugg] = useState<Place[] | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [manual, setManual] = useState('');
  async function findPlaces() {
    if (!center) return;
    setLoadingPlaces(true);
    try {
      const r = await fetch(`/api/out/places?lat=${center.lat}&lng=${center.lng}&activity=${encodeURIComponent(act)}&r=3&plan=${plan.id}`, { signal: AbortSignal.timeout(30000) });
      const j = await r.json();
      setSugg(j.places ?? []);
    } catch { setSugg([]); }
    setLoadingPlaces(false);
  }
  useEffect(() => { if (tab === 'where' && sugg === null && center) findPlaces(); /* eslint-disable-next-line */ }, [tab]);
  const pins = useMemo(() => [
    ...plan.places.filter((p) => p.lat).map((p) => ({ lat: Number(p.lat), lng: Number(p.lng), label: `${p.name} · ${faNum(p.votes)} رأی`, highlight: true })),
    ...(sugg ?? []).filter((s) => !plan.places.some((p) => p.name === s.name)).slice(0, 15).map((s) => ({ lat: s.lat, lng: s.lng, label: s.name })),
  ], [plan.places, sugg]);
  const bestPlace = [...plan.places].sort((a, b) => b.votes - a.votes)[0];

  // ---------- confirm ----------
  const [cSlot, setCSlot] = useState(best?.id ?? '');
  const [cPlace, setCPlace] = useState(bestPlace?.id ?? '');
  async function confirmPlan() {
    const ok = await run(() => supabase.rpc('confirm_outing_plan', { p_plan: plan.id, p_slot: cSlot, p_place: cPlace || null }));
    if (ok) fetch('/api/out/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'confirmed', id: plan.id }) }).catch(() => {});
  }
  const chosenSlot = plan.slots.find((s) => s.id === plan.chosen_slot);
  const chosenPlace = plan.places.find((p) => p.id === plan.chosen_place);

  // ---------- icebreakers ----------
  const sharedHobbies = useMemo(() => {
    const count: Record<string, number> = {};
    joined.forEach((m) => (m.hobbies ?? []).forEach((h) => (count[h] = (count[h] ?? 0) + 1)));
    return Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  }, [joined]);
  const [seed, setSeed] = useState(plan.id.charCodeAt(0) * 31);
  const ice = useMemo(() => pickIcebreakers({ hobbies: sharedHobbies, activity: topActivity, seed, n: 8 }), [sharedHobbies, topActivity, seed]);

  // ---------- chat ----------
  const [msgs, setMsgs] = useState<Msg[]>(initialMsgs);
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ch = supabase.channel(`out-${plan.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'outing_messages', filter: `plan_id=eq.${plan.id}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === (p.new as Msg).id) ? m : [...m, p.new as Msg])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [plan.id]);
  useEffect(() => { if (tab === 'chat') end.current?.scrollIntoView({ block: 'end' }); }, [msgs, tab]);
  async function send() {
    const body = text.trim(); if (!body) return;
    setText('');
    const { error } = await supabase.from('outing_messages').insert({ plan_id: plan.id, sender: me, body });
    if (error) setErr(errText(error.message));
  }

  return (
    <main className="page">
      <div className="flex items-start gap-2 mb-1">
        <h1 className="h1 !mb-1 flex-1">{plan.title}</h1>
        {plan.women_only && <span className="chip">👭 فقط خانم‌ها</span>}
      </div>
      {plan.note && <p className="text-xs text-muted mb-2">{plan.note}</p>}

      {plan.status === 'confirmed' ? (
        <div className="card mb-3 border-2 border-accent-soft">
          <p className="text-sm font-bold">✅ قطعی شد</p>
          {chosenSlot && <p className="text-sm mt-1">🗓️ {faDateTime(chosenSlot.starts_at)}</p>}
          {chosenPlace && <p className="text-sm mt-1">📍 {chosenPlace.name}{chosenPlace.address ? ` — ${chosenPlace.address}` : ''}</p>}
          {chosenPlace?.lat && <a className="btn btn-sm mt-2" href={directionsLink({ lat: Number(chosenPlace.lat), lng: Number(chosenPlace.lng) })} target="_blank" rel="noopener noreferrer">مسیریابی</a>}
        </div>
      ) : (
        <div className={`card mb-3 ${sp.get('new') ? 'border-2 border-primary' : ''}`}>
          <p className="text-xs text-muted">لینک دعوت ({faNum(joined.length)} از {faNum(plan.max_people)} نفر)</p>
          <div className="flex gap-2 items-center mt-1">
            <code className="text-xs flex-1 truncate" dir="ltr">{link}</code>
            <button className="btn btn-sm" onClick={share}>{copied ? 'کپی شد ✓' : 'بفرست'}</button>
          </div>
        </div>
      )}

      <div role="tablist" aria-label="بخش‌های برنامه" className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`chip shrink-0 py-2 ${tab === k ? 'chip-on' : 'chip-ghost'}`}>{l}</button>
        ))}
      </div>
      {err && <p className="text-sm text-warn my-2" role="alert">{err}</p>}

      <section role="tabpanel" className="mt-2">
        {tab === 'when' && (<>
          {plan.slots.length === 0 && <div className="card text-sm text-muted text-center">هنوز وقتی پیشنهاد نشده.</div>}
          {plan.slots.map((s) => {
            const isBest = best?.id === s.id && s.yes > 0;
            return (
              <div key={s.id} className={`card mb-2 ${isBest ? 'border-2 border-accent' : ''}`}>
                <div className="flex items-center gap-2">
                  <b className="text-sm flex-1">{faDateTime(s.starts_at)}</b>
                  {isBest && <span className="chip chip-accent">بهترین تا الان</span>}
                </div>
                <div className="h-2 rounded-full bg-[#EFEFF6] mt-2 overflow-hidden flex" aria-hidden>
                  <span className="bg-accent" style={{ width: `${(s.yes / Math.max(joined.length, 1)) * 100}%` }} />
                  <span className="bg-[#FDCB6E]" style={{ width: `${(s.maybe / Math.max(joined.length, 1)) * 100}%` }} />
                </div>
                <p className="text-[11px] text-muted mt-1">✅ {faNum(s.yes)} · 🤔 {faNum(s.maybe)} · ❌ {faNum(s.no)}{s.yes_names.length ? ` — ${s.yes_names.join('، ')}` : ''}</p>
                {plan.status === 'collecting' && (
                  <div className="flex gap-1.5 mt-2" role="radiogroup" aria-label="جواب من">
                    {([['yes', '✅ می‌تونم'], ['maybe', '🤔 شاید'], ['no', '❌ نه']] as const).map(([v, l]) => (
                      <button key={v} role="radio" aria-checked={s.mine === v} disabled={busy}
                        onClick={() => run(() => supabase.rpc('vote_outing_slot', { p_slot: s.id, p_answer: s.mine === v ? null : v }))}
                        className={`chip flex-1 justify-center py-2 ${s.mine === v ? 'chip-on' : ''}`}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {plan.status === 'collecting' && (
            <div className="card flex gap-2">
              <input type="datetime-local" className="input !py-2" dir="ltr" aria-label="وقت جدید" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
              <button className="btn btn-sm" disabled={!newSlot || busy} onClick={async () => { if (await run(() => supabase.rpc('add_outing_slot', { p_plan: plan.id, p_starts: new Date(newSlot).toISOString() }))) setNewSlot(''); }}>＋ وقت</button>
            </div>
          )}
        </>)}

        {tab === 'what' && (
          <div className="card">
            <p className="label">تو دوست داری کدوم‌ها رو انجام بدیم؟</p>
            <div className="flex flex-wrap gap-1.5">
              {plan.activity_options.map((a) => (
                <button key={a} aria-pressed={myActs.includes(a)} onClick={() => setMyActs(myActs.includes(a) ? myActs.filter((x) => x !== a) : [...myActs, a])}
                  className={`chip ${myActs.includes(a) ? 'chip-on' : ''}`}>{activityIcon(a)} {a} {tally[a] ? `· ${faNum(tally[a])}` : ''}</button>
              ))}
            </div>
            <button className="btn btn-sm mt-3" disabled={busy} onClick={() => run(() => supabase.rpc('set_outing_activities', { p_plan: plan.id, p_activities: myActs }))}>ثبت رأی</button>
            {Object.keys(tally).length > 0 && <p className="text-xs text-muted mt-3">فعلاً محبوب‌ترین: <b>{activityIcon(topActivity)} {topActivity}</b></p>}
          </div>
        )}

        {tab === 'where' && (<>
          {!center ? (
            <div className="card text-sm text-muted">برای پیشنهاد جا، یک محدوده لازم است: یا برگزارکننده محدوده را بگذارد، یا اعضا در پروفایلشان محدوده‌شان را ثبت کنند.</div>
          ) : (<>
            <div className="flex gap-2 mb-2 overflow-x-auto">
              {(plan.activity_options.length ? plan.activity_options : ['قهوه']).map((a) => (
                <button key={a} onClick={() => { setAct(a); setSugg(null); }} aria-pressed={act === a} className={`chip shrink-0 ${act === a ? 'chip-on' : 'chip-ghost'}`}>{activityIcon(a)} {a}</button>
              ))}
              <button className="chip chip-accent shrink-0" onClick={findPlaces} disabled={loadingPlaces}>{loadingPlaces ? '…' : '🔄 جستجو'}</button>
            </div>
            <LeafletMap center={center} pins={pins} circleKm={3} />
            {plan.venue_hint?.prefer_alcohol_free && <p className="text-[11px] text-muted mt-1">جاهای بدون الکل جلوتر نشان داده شده‌اند.</p>}
          </>)}

          <h2 className="section">جاهای پیشنهادی گروه</h2>
          {plan.places.length === 0 && <p className="text-xs text-muted">هنوز جایی اضافه نشده. از پیشنهادهای زیر اضافه کن یا اسم جایی را بنویس.</p>}
          {[...plan.places].sort((a, b) => b.votes - a.votes).map((p) => (
            <div key={p.id} className="card mb-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <b className="text-sm block truncate">{p.name}</b>
                {p.address && <span className="text-[11px] text-muted block truncate">{p.address}</span>}
                <span className="text-[11px] text-muted">{faNum(p.votes)} رأی</span>
                {p.url && <a className="text-[11px] text-primary ms-2" href={p.url} target="_blank" rel="noopener noreferrer">جزئیات</a>}
              </div>
              <button className={`chip ${p.mine ? 'chip-on' : ''}`} aria-pressed={p.mine} disabled={busy}
                onClick={() => run(() => supabase.rpc('toggle_outing_place_vote', { p_place: p.id }))}>👍</button>
            </div>
          ))}
          <div className="card flex gap-2 mt-2">
            <input className="input !py-2" aria-label="اسم جا" placeholder="یه جای دیگه بلدی؟ اسمش را بنویس" maxLength={120} value={manual} onChange={(e) => setManual(e.target.value)} />
            <button className="btn btn-sm" disabled={!manual.trim() || busy} onClick={async () => { if (await run(() => supabase.rpc('add_outing_place', { p_plan: plan.id, p_place: { name: manual.trim(), provider: 'manual' } }))) setManual(''); }}>＋</button>
          </div>

          {sugg && sugg.length > 0 && <>
            <h2 className="section">پیشنهاد نقشه برای {act}</h2>
            {sugg.filter((s) => !plan.places.some((p) => p.name === s.name)).slice(0, 12).map((s) => (
              <div key={s.name + s.lat} className="card mb-2 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <b className="text-sm block truncate" dir="auto">{s.name}</b>
                  <span className="text-[11px] text-muted block truncate" dir="auto">{[s.address, ...(s.tags ?? [])].filter(Boolean).join(' · ')}</span>
                </div>
                <button className="btn btn-sec btn-sm" disabled={busy} onClick={() => run(() => supabase.rpc('add_outing_place', { p_plan: plan.id, p_place: { ...s, kind: act } }))}>＋ به گروه</button>
              </div>
            ))}
          </>}
          {sugg && sugg.length === 0 && !loadingPlaces && <p className="text-xs text-muted mt-2">چیزی پیدا نشد؛ یک فعالیت دیگر را امتحان کن یا اسم جا را دستی بنویس.</p>}
          <p className="text-[10px] text-muted mt-3">دادهٔ نقشه: © OpenStreetMap contributors</p>
        </>)}

        {tab === 'who' && (<>
          {plan.members.map((m) => <OutCard key={m.id} c={m} self={m.id === me} />)}
          <p className="text-[11px] text-muted">🔒 مصرف الکل/ماریجوانا/سیگار هر کس فقط وقتی اینجا دیده می‌شود که هم او و هم تو آن را «دوطرفه» گذاشته باشید.</p>
        </>)}

        {tab === 'talk' && (<>
          {sharedHobbies.length > 0 && <p className="text-xs text-muted mb-2">علاقه‌های مشترک گروه: {sharedHobbies.slice(0, 5).join('، ')}</p>}
          {ice.map((q, i) => (
            <div key={i} className="card mb-2">
              <span className={`chip !text-[10px] ${q.kind === 'بازی' ? 'chip-accent' : 'chip-ghost'}`}>{q.kind}{q.tag ? ` · ${q.tag}` : ''}</span>
              <p className="text-sm font-bold mt-1">{q.text}</p>
              {q.how && <p className="text-xs text-muted mt-1">{q.how}</p>}
            </div>
          ))}
          <button className="btn btn-sec w-full" onClick={() => setSeed(seed + 7)}>🎲 چندتا دیگه</button>
        </>)}

        {tab === 'chat' && (
          <div className="card">
            <div className="space-y-2 max-h-[55vh] overflow-y-auto" aria-live="polite">
              {msgs.map((m) => m.sender === null ? (
                <p key={m.id} className="text-center text-[11px] text-muted">{m.body}</p>
              ) : (
                <div key={m.id} className={`flex ${m.sender === me ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.sender === me ? 'bg-primary text-white' : 'bg-[#F1F1F7]'}`}>
                    {m.sender !== me && <span className="block text-[10px] font-bold opacity-70">{names[m.sender]?.name ?? '…'}</span>}
                    {m.body}
                  </div>
                </div>
              ))}
              <div ref={end} />
            </div>
            {plan.status !== 'cancelled' && (
              <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input className="input !py-2" aria-label="پیام" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="بنویس…" />
                <button className="btn btn-sm" disabled={!text.trim()}>بفرست</button>
              </form>
            )}
          </div>
        )}
      </section>

      {plan.is_organizer && plan.status === 'collecting' && (
        <div className="card mt-4 space-y-2">
          <p className="text-sm font-bold">قطعی کردن (فقط برگزارکننده)</p>
          <select className="input" aria-label="وقت نهایی" value={cSlot} onChange={(e) => setCSlot(e.target.value)}>
            <option value="">— وقت —</option>
            {plan.slots.map((s) => <option key={s.id} value={s.id}>{faDateTime(s.starts_at)} (✅ {faNum(s.yes)})</option>)}
          </select>
          <select className="input" aria-label="جای نهایی" value={cPlace} onChange={(e) => setCPlace(e.target.value)}>
            <option value="">— جا (اختیاری) —</option>
            {plan.places.map((p) => <option key={p.id} value={p.id}>{p.name} ({faNum(p.votes)} رأی)</option>)}
          </select>
          <button className="btn w-full" disabled={!cSlot || busy} onClick={confirmPlan}>✅ قطعی کن و به همه خبر بده</button>
        </div>
      )}

      <button className="text-xs text-warn mt-6 w-full" disabled={busy}
        onClick={async () => { if (window.confirm(plan.is_organizer ? 'برنامه برای همه لغو شود؟' : 'از این برنامه بیرون بروی؟')) { await run(() => supabase.rpc('leave_outing_plan', { p_plan: plan.id })); router.push('/out'); } }}>
        {plan.is_organizer ? 'لغو برنامه' : 'خروج از برنامه'}
      </button>
    </main>
  );
}
