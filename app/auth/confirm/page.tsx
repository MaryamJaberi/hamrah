'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/** Magic-link landing: /auth/confirm?token_hash=…  (set the Supabase email template to link here). */
function Confirm() {
  const params = useSearchParams();
  const router = useRouter();
  const [err, setErr] = useState('');
  useEffect(() => {
    const token_hash = params.get('token_hash');
    if (!token_hash) { setErr('لینک نامعتبر است'); return; }
    createClient().auth.verifyOtp({ token_hash, type: 'email' }).then(({ error }) => {
      if (error) setErr('لینک منقضی شده است'); else { router.replace('/discover'); router.refresh(); }
    });
  }, [params, router]);
  return <p className="p-6 text-center mt-24" role={err ? 'alert' : 'status'}>{err || 'در حال ورود…'}</p>;
}
export default function Page() { return <Suspense><Confirm /></Suspense>; }
