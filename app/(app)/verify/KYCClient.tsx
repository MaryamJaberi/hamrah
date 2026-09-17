'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function validIranianNationalCode(code: string) {
  if (!/^\d{10}$/.test(code) || /^(\d)\1{9}$/.test(code)) return false;
  const sum = code.slice(0, 9).split('').reduce((a, d, i) => a + Number(d) * (10 - i), 0) % 11;
  const check = Number(code[9]);
  return sum < 2 ? check === sum : check === 11 - sum;
}

type Last = { status: string; reject_reason: string | null } | null;
type Doc = 'national_id' | 'passport';

export default function KYCClient({ name, last, personaEnabled }: { name: string; last: Last; personaEnabled: boolean }) {
  const [step, setStep] = useState(0);
  const [doc, setDoc] = useState<Doc>('national_id');
  const [fullName, setFullName] = useState(name);
  const [number, setNumber] = useState('');
  const [birth, setBirth] = useState('');
  const [files, setFiles] = useState<{ front?: File; back?: File; selfie?: File }>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  if (last?.status === 'pending' || last?.status === 'approved') {
    return (
      <div className="text-center mt-16">
        <div className="text-6xl mb-3" aria-hidden>{last.status === 'approved' ? '✅' : '⏳'}</div>
        <h1 className="text-xl font-extrabold mb-2">{last.status === 'approved' ? 'هویت شما تأیید شده' : 'در انتظار بررسی'}</h1>
        <p className="text-sm text-muted mb-6">{last.status === 'pending' && 'معمولاً کمتر از ۲۴ ساعت طول می‌کشد.'}</p>
        <Link href="/profile" className="btn">بازگشت به پروفایل</Link>
      </div>
    );
  }

  const numberOk = doc === 'national_id' ? validIranianNationalCode(number) : /^[A-Z0-9]{6,12}$/i.test(number);

  async function submit() {
    setBusy(true); setErr('');
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const up = async (f: File | undefined, kind: string) => {
        if (!f) return null;
        if (f.size > 8 * 1024 * 1024) throw new Error('حجم هر عکس حداکثر ۸ مگابایت');
        const path = `${user!.id}/${kind}-${Date.now()}.${(f.name.split('.').pop() || 'jpg').toLowerCase()}`;
        const { error } = await supabase.storage.from('kyc').upload(path, f, { contentType: f.type });
        if (error) throw error;
        return path;
      };
      const [front, back, selfie] = await Promise.all([up(files.front, 'front'), up(files.back, 'back'), up(files.selfie, 'selfie')]);
      const { error } = await supabase.from('kyc_submissions').insert({
        user_id: user!.id, kind: doc, doc_front_path: front, doc_back_path: back, selfie_path: selfie,
        document_number: number, birth_date: birth || null, full_name: fullName.trim(), status: 'pending',
      });
      if (error) throw error;
      router.refresh();
    } catch (e: any) {
      setErr(e.message ?? 'ارسال نشد');
    } finally { setBusy(false); }
  }

  async function persona() {
    setBusy(true);
    const res = await fetch('/api/kyc/persona', { method: 'POST' });
    const json = await res.json();
    if (json.url) window.location.href = json.url; else { setErr(json.error ?? 'خطا'); setBusy(false); }
  }

  return (
    <>
      <h1 className="h1 mb-1">تأیید هویت</h1>
      <p className="text-xs text-muted mb-4">مدارک در فضای خصوصی ذخیره می‌شوند و فقط تیم بررسی آن‌ها را می‌بیند.</p>
      {last?.status === 'rejected' && <div role="alert" className="card bg-warn-soft text-warn text-sm mb-3">درخواست قبلی رد شد{last.reject_reason ? `: ${last.reject_reason}` : ''}</div>}
      <div className="flex gap-1.5 mb-5" aria-hidden>{[0, 1, 2].map((i) => <div key={i} className={`flex-1 h-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-line'}`} />)}</div>

      {step === 0 && (
        <div className="card space-y-3">
          {personaEnabled && <button className="btn btn-ghost w-full" disabled={busy} onClick={persona}>تأیید خودکار با Persona (بین‌المللی)</button>}
          <div className="flex gap-2">{([['national_id', 'کارت ملی'], ['passport', 'پاسپورت']] as const).map(([k, l]) => (
            <button key={k} aria-pressed={doc === k} onClick={() => { setDoc(k); setNumber(''); }} className={`chip flex-1 justify-center py-2 ${doc === k ? 'chip-on' : ''}`}>{l}</button>))}</div>
          <div><label className="label" htmlFor="k-name">نام کامل طبق مدرک</label><input id="k-name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div><label className="label" htmlFor="k-num">{doc === 'national_id' ? 'کد ملی' : 'شماره پاسپورت'}</label>
            <input id="k-num" className="input text-center tracking-widest" dir="ltr" inputMode={doc === 'national_id' ? 'numeric' : 'text'} maxLength={doc === 'national_id' ? 10 : 12}
              value={number} onChange={(e) => setNumber(doc === 'national_id' ? e.target.value.replace(/\D/g, '') : e.target.value.toUpperCase())} />
            {number.length >= (doc === 'national_id' ? 10 : 6) && !numberOk && <p role="alert" className="text-warn text-xs mt-1">{doc === 'national_id' ? 'کد ملی معتبر نیست' : 'شماره پاسپورت معتبر نیست'}</p>}
          </div>
          <div><label className="label" htmlFor="k-birth">تاریخ تولد</label><input id="k-birth" className="input" type="date" dir="ltr" value={birth} onChange={(e) => setBirth(e.target.value)} /></div>
          <button className="btn w-full" disabled={!fullName.trim() || !numberOk} onClick={() => setStep(1)}>بعدی</button>
        </div>
      )}

      {step === 1 && (
        <div className="card space-y-4">
          <Upload label={doc === 'national_id' ? 'روی کارت ملی' : 'صفحه اطلاعات پاسپورت'} onFile={(f) => setFiles({ ...files, front: f })} />
          {doc === 'national_id' && <Upload label="پشت کارت (اختیاری)" onFile={(f) => setFiles({ ...files, back: f })} />}
          <div className="flex gap-2"><button className="btn btn-sec flex-1" onClick={() => setStep(0)}>قبلی</button><button className="btn flex-1" disabled={!files.front} onClick={() => setStep(2)}>بعدی</button></div>
        </div>
      )}

      {step === 2 && (
        <div className="card space-y-4">
          <p className="text-xs text-muted">مدرک را کنار صورتت بگیر و یک سلفی واضح بگیر.</p>
          <Upload label="سلفی با مدرک" capture="user" onFile={(f) => setFiles({ ...files, selfie: f })} />
          <div className="flex gap-2"><button className="btn btn-sec flex-1" onClick={() => setStep(1)}>قبلی</button>
            <button className="btn flex-1" disabled={busy || !files.selfie} onClick={submit}>{busy ? 'در حال ارسال…' : 'ارسال برای بررسی'}</button></div>
        </div>
      )}
      {err && <p role="alert" className="text-warn text-sm mt-3">{err}</p>}
    </>
  );
}

function Upload({ label, capture, onFile }: { label: string; capture?: 'user' | 'environment'; onFile: (f: File) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer ${preview ? 'border-accent bg-accent-soft' : 'border-line'}`}>
        {preview ? <img src={preview} alt="" className="max-h-40 mx-auto rounded-lg" /> : <span className="text-muted text-sm"><span className="block text-3xl" aria-hidden>📷</span>انتخاب یا گرفتن عکس</span>}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture={capture} className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { setPreview(URL.createObjectURL(f)); onFile(f); } }} />
      </div>
    </label>
  );
}
