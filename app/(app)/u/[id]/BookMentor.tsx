'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatPrice } from '@/lib/format';
import type { Profile } from '@/lib/types';

export default function BookMentor({ mentor, existingConnId }: { mentor: Profile; existingConnId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  async function book() {
    setBusy(true); setErr('');
    if (mentor.mentor_price === 0) {
      const { data, error } = await createClient().rpc('start_free_mentorship', { p_mentor: mentor.id });
      if (error || !data) { setErr('شروع نشد.'); setBusy(false); return; }
      return router.push(`/chat/${data}`);
    }
    // provider follows the mentor's currency: IRR → Zarinpal, USD/EUR → Stripe
    const endpoint = mentor.mentor_currency === 'irr' ? '/api/payments/zarinpal/request' : '/api/payments/stripe/checkout';
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mentorId: mentor.id }) });
    const json = await res.json().catch(() => ({}));
    if (json.url) window.location.href = json.url;
    else { setErr(json.error ?? 'خطا در اتصال به درگاه'); setBusy(false); }
  }

  return (
    <>
      {existingConnId && <button className="btn btn-sec w-full mb-2" onClick={() => router.push(`/chat/${existingConnId}`)}>گفتگو با منتور</button>}
      <button className="btn w-full" disabled={busy} onClick={book}>
        {busy ? '…' : mentor.mentor_price ? `رزرو جلسه · ${formatPrice(mentor.mentor_price, mentor.mentor_currency)}` : existingConnId ? 'ادامه منتورشیپ' : 'شروع منتورشیپ رایگان'}
      </button>
      {mentor.mentor_price > 0 && <p className="text-[11px] text-muted mt-2 text-center">پرداخت از طریق {mentor.mentor_currency === 'irr' ? 'زرین‌پال' : 'Stripe'}</p>}
      {err && <p role="alert" className="text-warn text-xs mt-2">{err}</p>}
    </>
  );
}
