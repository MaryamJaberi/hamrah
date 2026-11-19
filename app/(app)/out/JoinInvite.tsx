'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Paste an invite link or code. */
export default function JoinInvite() {
  const [v, setV] = useState('');
  const router = useRouter();
  const code = v.trim().split('/').filter(Boolean).pop()?.toUpperCase() ?? '';
  return (
    <form className="card mt-3 flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); if (code.length >= 6) router.push(`/out/join/${code}`); }}>
      <div className="flex-1">
        <label className="label !text-xs" htmlFor="inv">لینک یا کد دعوت داری؟</label>
        <input id="inv" className="input !py-2" dir="ltr" placeholder="AB12CD34" value={v} onChange={(e) => setV(e.target.value)} />
      </div>
      <button className="btn btn-sm" disabled={code.length < 6}>برو</button>
    </form>
  );
}
