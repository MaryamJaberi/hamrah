'use client';
import { useEffect, useState } from 'react';

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks for notification permission only when the user taps — never on page load. */
export default function PushToggle() {
  const [state, setState] = useState<'unsupported' | 'off' | 'on' | 'denied' | 'busy'>('off');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return setState('unsupported');
    if (Notification.permission === 'denied') return setState('denied');
    navigator.serviceWorker.getRegistration('/sw.js').then(async (reg) => {
      if (reg && (await reg.pushManager.getSubscription())) setState('on');
    });
  }, []);

  async function enable() {
    setState('busy');
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      if ((await Notification.requestPermission()) !== 'granted') return setState('denied');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) });
      await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub) });
      setState('on');
    } catch { setState('off'); }
  }

  if (state === 'unsupported') return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">اعلان پیام‌ها و درخواست‌ها</span>
      {state === 'on' ? <span className="chip chip-accent">فعال ✓</span>
        : state === 'denied' ? <span className="chip chip-ghost">در تنظیمات مرورگر مسدود است</span>
        : <button className="btn btn-sm" disabled={state === 'busy'} onClick={enable}>فعال کردن</button>}
    </div>
  );
}
