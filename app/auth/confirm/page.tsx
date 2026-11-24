'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Auth landing: handles both OAuth PKCE (?code=…) and email magic links (?token_hash=…). */
function Confirm() {
  const params = useSearchParams();
  const [err, setErr] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const nextRaw = params.get('next');
    const target = (nextRaw && nextRaw.startsWith('/') && !nextRaw.startsWith('//')) ? nextRaw : '/discover';
    const code = params.get('code');
    const token_hash = params.get('token_hash');
    const sb = createClient();

    (async () => {
      if (code) {
        // createBrowserClient may have already auto-exchanged the PKCE code on mount
        const { data: { session: existing } } = await sb.auth.getSession();
        if (existing) {
          window.location.replace(target);
          return;
        }
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (!error) {
          window.location.replace(target);
          return;
        }
        // Re-check in case auto-detection completed concurrently
        const { data: { session: after } } = await sb.auth.getSession();
        if (after) {
          window.location.replace(target);
          return;
        }
        setErr('ورود با گوگل کامل نشد؛ دوباره امتحان کن');
        return;
      }

      if (!token_hash) {
        const { data: { session } } = await sb.auth.getSession();
        if (session) {
          window.location.replace(target);
          return;
        }
        setErr('لینک نامعتبر است');
        return;
      }

      const { error } = await sb.auth.verifyOtp({ token_hash, type: 'email' });
      if (error) setErr('لینک منقضی شده است');
      else window.location.replace(target);
    })();
  }, [params]);

  return <p className="p-6 text-center mt-24" role={err ? 'alert' : 'status'}>{err || 'در حال ورود…'}</p>;
}
export default function Page() { return <Suspense><Confirm /></Suspense>; }
