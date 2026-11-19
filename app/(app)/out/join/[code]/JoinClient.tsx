'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { errText } from '@/lib/outings';

export default function JoinClient({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  async function join() {
    setBusy(true); setErr('');
    const { data, error } = await createClient().rpc('join_outing_plan', { p_code: code });
    setBusy(false);
    if (error) return setErr(errText(error.message));
    router.push(`/out/p/${data}`);
  }
  return (<>
    <button className="btn w-full" disabled={busy} onClick={join}>{busy ? '…' : 'پایه‌ام، بپیوندم 🙌'}</button>
    {err && <p className="text-sm text-warn" role="alert">{err}</p>}
  </>);
}
