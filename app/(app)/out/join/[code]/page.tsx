import { redirect } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import JoinClient from './JoinClient';

export const dynamic = 'force-dynamic';

export default async function Join({ params }: { params: { code: string } }) {
  const { supabase } = await getSession();
  const { data } = await supabase.rpc('outing_plan_preview', { p_code: params.code });
  const p = data as any;
  if (p?.is_member) redirect(`/out/p/${p.id}`);
  return (
    <main className="page">
      {!p ? (
        <div className="card text-center py-10 text-sm text-muted">این دعوت پیدا نشد. لینک را دوباره چک کن.</div>
      ) : (
        <div className="card text-center space-y-3 py-6">
          <div className="text-5xl" aria-hidden>{p.organizer_avatar}</div>
          <p className="text-sm"><b>{p.organizer_name}</b> دعوتت کرده به</p>
          <h1 className="text-xl font-extrabold">{p.title}</h1>
          <p className="text-xs text-muted">{p.area_label ? `${p.area_label} · ` : ''}{Number(p.members).toLocaleString('fa-IR')} از {Number(p.max_people).toLocaleString('fa-IR')} نفر{p.women_only ? ' · 👭 فقط خانم‌ها' : ''}</p>
          <JoinClient code={params.code} />
          <p className="text-[11px] text-muted">با پیوستن، اسم و آواتارت را اعضا می‌بینند. بقیه‌ی اطلاعاتت طبق تنظیمات حریم خصوصی‌ات نشان داده می‌شود.</p>
        </div>
      )}
    </main>
  );
}
