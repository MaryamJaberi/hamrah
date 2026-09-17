import Link from 'next/link';
import { getSession } from '@/lib/supabase/server';
import { listConnections } from '@/lib/connections';

export default async function ChatList() {
  const { supabase, user } = await getSession();
  const conns = await listConnections(supabase, user!.id);
  const ids = conns.map((c) => c.id);
  const { data: recent } = ids.length
    ? await supabase.from('messages').select('connection_id,body,created_at').in('connection_id', ids).order('created_at', { ascending: false }).limit(300)
    : { data: [] };
  const last = new Map<string, { body: string; created_at: string }>();
  (recent ?? []).forEach((m) => { if (!last.has(m.connection_id)) last.set(m.connection_id, m); });
  const sorted = [...conns].sort((x, y) => (last.get(y.id)?.created_at ?? y.created_at).localeCompare(last.get(x.id)?.created_at ?? x.created_at));

  return (
    <main className="page">
      <h1 className="h1">گفتگوها</h1>
      {sorted.length === 0 && (
        <div className="text-center mt-16">
          <div className="text-5xl mb-3 opacity-50" aria-hidden>💬</div>
          <p className="font-bold mb-1">هنوز گفتگویی نداری</p>
          <p className="text-sm text-muted mb-4">از «کشف» یک همراه پیدا کن.</p>
          <Link href="/discover" className="btn">پیدا کردن همراه</Link>
        </div>
      )}
      {sorted.map((c) => (
        <Link key={c.id} href={`/chat/${c.id}`} className="card flex items-center gap-3 mb-2">
          <div className="text-2xl" aria-hidden>{c.other.avatar}</div>
          <div className="flex-1 min-w-0">
            <div className="font-bold flex items-center gap-2">{c.other.name}{c.kind === 'mentorship' && <span className="chip text-[10px]">منتورشیپ</span>}</div>
            <div className="text-xs text-muted truncate">{last.get(c.id)?.body ?? 'شروع گفتگو…'}</div>
          </div>
        </Link>
      ))}
    </main>
  );
}
