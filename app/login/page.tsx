'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Method = 'email' | 'phone';
type AuthMode = 'otp' | 'password';

export default function Login() {
  const [method, setMethod] = useState<Method>('email');
  const [authMode, setAuthMode] = useState<AuthMode>('otp');
  const [isSignUp, setIsSignUp] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'id' | 'code'>('id');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!sbUrl || sbUrl.includes('example.supabase.co') || !sbKey) return;
    fetch(`${sbUrl}/auth/v1/settings`, { headers: { apikey: sbKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.external?.google === true) setGoogleEnabled(true);
      })
      .catch(() => {});
  }, []);

  function getTarget() {
    if (typeof window === 'undefined') return '/discover';
    const nextUrl = new URLSearchParams(window.location.search).get('next');
    return nextUrl && nextUrl.startsWith('/') && !nextUrl.startsWith('//') ? nextUrl : '/discover';
  }

  async function loginWithGoogle() {
    setBusy(true); setErr(''); setInfo('');
    const target = getTarget();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(target)}` },
    });
    if (error) {
      console.error('login: google oauth failed', error);
      setErr('ورود با گوگل در حال حاضر فعال نیست یا با خطا مواجه شد.');
      setBusy(false);
    }
  }

  async function submitPassword() {
    setBusy(true); setErr(''); setInfo('');
    const cleanId = id.trim();
    const creds = method === 'email'
      ? { email: cleanId, password }
      : { phone: cleanId.replace(/\s+/g, ''), password };

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp(creds as any);
      if (error) {
        console.error('login: signup failed', error);
        setErr(error.message?.includes('already') ? 'این حساب قبلاً ثبت شده؛ حالت «ورود» را انتخاب کن' : 'ثبت‌نام انجام نشد؛ اطلاعات را بررسی کن');
        setBusy(false);
        return;
      }
      if (!data.session) {
        setInfo('لینک یا کد تأیید برایت فرستاده شد؛ پس از تأیید وارد شو.');
        setBusy(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword(creds as any);
      if (error) {
        console.error('login: password signin failed', error);
        setErr('اطلاعات ورود اشتباه است (اگر هنوز ثبت‌نام نکرده‌ای، «ساخت حساب» را بزن)');
        setBusy(false);
        return;
      }
    }
    router.replace(getTarget());
    router.refresh();
  }

  async function send() {
    setBusy(true); setErr(''); setInfo('');
    if (method === 'email') {
      const { error } = await supabase.auth.signInWithOtp({ email: id.trim(), options: { shouldCreateUser: true } });
      if (error) { console.error('login: send code failed', error); setErr(error.status === 429 ? 'چند بار پشت‌سرهم درخواست دادی؛ کمی بعد دوباره امتحان کن' : 'کد فرستاده نشد، دوباره امتحان کن'); } else setStep('code');
    } else {
      const res = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: id }) });
      const json = await res.json();
      if (!res.ok) setErr(json.error); else setStep('code');
    }
    setBusy(false);
  }

  async function verify() {
    setBusy(true); setErr(''); setInfo('');
    if (method === 'email') {
      const { error } = await supabase.auth.verifyOtp({ email: id.trim(), token: code, type: 'email' });
      if (error) { setErr('کد اشتباه یا منقضی است'); setBusy(false); return; }
    } else {
      const res = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: id, code }) });
      const json = await res.json();
      if (!res.ok) { setErr(json.error); setBusy(false); return; }
      const { error } = await supabase.auth.verifyOtp({ token_hash: json.token_hash, type: 'email' });
      if (error) { console.error('login: session exchange failed', error); setErr('ورود کامل نشد، دوباره امتحان کن'); setBusy(false); return; }
    }
    router.replace(getTarget());
    router.refresh();
  }

  const emailOk = /^\S+@\S+\.\S+$/.test(id.trim());
  const phoneOk = id.replace(/\D/g, '').length >= 10;
  const idOk = method === 'email' ? emailOk : phoneOk;
  const passOk = password.length >= 6;

  return (
    <main className="min-h-screen p-5 flex flex-col justify-center max-w-md mx-auto">
      <div className="card p-6">
        <div className="text-4xl mb-3">🤝</div>
        <h1 className="text-2xl font-extrabold mb-1.5">ورود به همراه</h1>
        <p className="text-muted text-sm mb-5">روش دلخواهت را برای ورود یا ثبت‌نام انتخاب کن:</p>

        {step === 'id' ? (
          <>
            {googleEnabled && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={loginWithGoogle}
                  className="w-full mb-4 py-2.5 px-4 rounded-xl border-2 border-line bg-white hover:bg-gray-50 font-bold text-sm flex items-center justify-center gap-2.5 transition"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>ورود با گوگل (Google)</span>
                </button>

                <div className="flex items-center gap-3 my-4 text-xs text-muted">
                  <span className="flex-1 h-px bg-line" />
                  <span>یا با ایمیل / موبایل</span>
                  <span className="flex-1 h-px bg-line" />
                </div>
              </>
            )}

            <div className="flex gap-2 mb-3" role="tablist">
              {(['email', 'phone'] as const).map((m) => (
                <button key={m} role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setId(''); setErr(''); setInfo(''); }}
                  className={`chip flex-1 justify-center py-2 ${method === m ? 'chip-on' : ''}`}>{m === 'email' ? 'ایمیل' : 'شماره موبایل'}</button>
              ))}
            </div>

            <div className="flex gap-2 mb-4 text-xs">
              <button type="button" onClick={() => { setAuthMode('otp'); setErr(''); setInfo(''); }}
                className={`flex-1 py-1.5 rounded-lg border font-bold ${authMode === 'otp' ? 'border-primary bg-primary-soft/50 text-indigo-950' : 'border-line text-muted'}`}>
                📩 کد یک‌بارمصرف
              </button>
              <button type="button" onClick={() => { setAuthMode('password'); setErr(''); setInfo(''); }}
                className={`flex-1 py-1.5 rounded-lg border font-bold ${authMode === 'password' ? 'border-primary bg-primary-soft/50 text-indigo-950' : 'border-line text-muted'}`}>
                🔑 رمز عبور
              </button>
            </div>

            <label className="label" htmlFor="login-id">{method === 'email' ? 'ایمیل' : 'شماره موبایل'}</label>
            <input id="login-id" className="input mb-3" dir="ltr" autoComplete={method === 'email' ? 'email' : 'tel'}
              type={method === 'email' ? 'email' : 'tel'} placeholder={method === 'email' ? 'you@example.com' : '0912… / +31 6…'}
              value={id} onChange={(e) => setId(e.target.value)} />

            {authMode === 'password' ? (
              <>
                <label className="label" htmlFor="login-pass">رمز عبور</label>
                <input id="login-pass" className="input mb-4" dir="ltr" type="password" autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="حداقل ۶ کاراکتر" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="btn w-full" disabled={busy || !idOk || !passOk} onClick={submitPassword}>
                  {busy ? '…' : (isSignUp ? 'ساخت حساب جدید' : 'ورود با رمز عبور')}
                </button>
                <button type="button" className="mt-3 text-xs text-indigo-950 font-bold underline block mx-auto" onClick={() => { setIsSignUp(!isSignUp); setErr(''); setInfo(''); }}>
                  {isSignUp ? 'قبلاً حساب داشتی؟ ورود' : 'حساب نداری؟ ساخت حساب جدید'}
                </button>
              </>
            ) : (
              <button className="btn w-full mt-1" disabled={busy || !idOk} onClick={send}>
                {busy ? '…' : 'ارسال کد'}
              </button>
            )}
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
        {info && <p role="status" className="text-emerald-700 text-sm mt-3 font-medium">{info}</p>}
        {err && <p role="alert" className="text-warn text-sm mt-3">{err}</p>}
      </div>
      <Link href="/d" className="card mt-5 p-4 flex items-center justify-between gap-3 text-sm border-2 border-primary-soft">
        <span className="leading-relaxed">🌿 <b>دورهمی و «بریم بیرون؟»</b> <span className="text-muted text-xs">(بدون نیاز به ثبت‌نام)</span></span>
        <span className="text-indigo-950 font-extrabold whitespace-nowrap shrink-0">شروع آزاد ←</span>
      </Link>
    </main>
  );
}
