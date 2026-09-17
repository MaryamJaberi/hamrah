'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Method = 'email' | 'phone';

export default function Login() {
  const [method, setMethod] = useState<Method>('email');
  const [id, setId] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'id' | 'code'>('id');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  const supabase = createClient();

  async function send() {
    setBusy(true); setErr('');
    if (method === 'email') {
      const { error } = await supabase.auth.signInWithOtp({ email: id.trim(), options: { shouldCreateUser: true } });
      if (error) setErr(error.message); else setStep('code');
    } else {
      const res = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: id }) });
      const json = await res.json();
      if (!res.ok) setErr(json.error); else setStep('code');
    }
    setBusy(false);
  }

  async function verify() {
    setBusy(true); setErr('');
    if (method === 'email') {
      const { error } = await supabase.auth.verifyOtp({ email: id.trim(), token: code, type: 'email' });
      if (error) { setErr('کد اشتباه یا منقضی است'); setBusy(false); return; }
    } else {
      const res = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: id, code }) });
      const json = await res.json();
      if (!res.ok) { setErr(json.error); setBusy(false); return; }
      const { error } = await supabase.auth.verifyOtp({ token_hash: json.token_hash, type: 'email' });
      if (error) { setErr(error.message); setBusy(false); return; }
    }
    router.replace('/discover');
    router.refresh();
  }

  const emailOk = /^\S+@\S+\.\S+$/.test(id.trim());
  const phoneOk = id.replace(/\D/g, '').length >= 10;

  return (
    <main className="min-h-screen p-6 flex flex-col justify-center">
      <div className="text-5xl mb-4">🤝</div>
      <h1 className="text-2xl font-extrabold mb-2">خوش اومدی به همراه</h1>
      <p className="text-muted text-sm mb-6">یک کد یک‌بارمصرف برات می‌فرستیم.</p>

      {step === 'id' ? (
        <>
          <div className="flex gap-2 mb-4" role="tablist">
            {(['email', 'phone'] as const).map((m) => (
              <button key={m} role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setId(''); }}
                className={`chip flex-1 justify-center py-2 ${method === m ? 'chip-on' : ''}`}>{m === 'email' ? 'ایمیل' : 'شماره موبایل'}</button>
            ))}
          </div>
          <label className="label" htmlFor="login-id">{method === 'email' ? 'ایمیل' : 'شماره موبایل'}</label>
          <input id="login-id" className="input mb-4" dir="ltr" autoComplete={method === 'email' ? 'email' : 'tel'}
            type={method === 'email' ? 'email' : 'tel'} placeholder={method === 'email' ? 'you@example.com' : '0912… / +31 6…'}
            value={id} onChange={(e) => setId(e.target.value)} />
          <button className="btn w-full" disabled={busy || !(method === 'email' ? emailOk : phoneOk)} onClick={send}>
            {busy ? '…' : 'ارسال کد'}
          </button>
        </>
      ) : (
        <>
          <label className="label" htmlFor="otp">کد ارسال‌شده به {id}</label>
          <input id="otp" className="input mb-4 text-center tracking-[.5em] text-2xl" dir="ltr" inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="btn w-full" disabled={busy || code.length < 6} onClick={verify}>{busy ? '…' : 'ورود'}</button>
          <button className="mt-3 text-muted text-sm" onClick={() => { setStep('id'); setCode(''); }}>تغییر {method === 'email' ? 'ایمیل' : 'شماره'}</button>
        </>
      )}
      {err && <p role="alert" className="text-warn text-sm mt-3">{err}</p>}
    </main>
  );
}
