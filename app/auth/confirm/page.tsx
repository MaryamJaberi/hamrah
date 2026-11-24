'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Auth landing: handles both OAuth PKCE (?code=…) and email magic links (?token_hash=…). */
function Confirm() {
  const params = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState('');
  useEffect(() => {
    const nextRaw = params.get('next');
    const target = (nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')) ? nextRaw : '/discover';
    const code = params.get('code');
    const token_hash = params.get('token_hash');
    const sb = createClient();
    if (code) {
      sb.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setErr('ورود با گوگل کامل نشد؛ دوباره امتحان کن');
        else { router.replace(target); router.refresh(); }
      });
      return;
    }
    if (!token_hash) { setErr('لینک نامعتبر است'); return; }
    sb.auth.verifyOtp({ token_hash, type: 'email' }).then(({ error }) => {
      if (error) setErr('لینک منقضی شده است'); else { router.replace(target); router.refresh(); }
    });
  }, [params, router]);
  return <p className="p-6 text-center mt-24" role={err ? 'alert' : 'status'}>{err || 'در حال ورود…'}</p>;
}
export default function Page() { return <Suspense><Confirm /></Suspense>; }
