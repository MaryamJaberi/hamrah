'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Small button that POSTs to an admin API route, optionally asking for a text reason first. */
export default function AdminAction({ endpoint, body, label, variant = '', prompt, confirmText }: {
  endpoint: string; body: Record<string, unknown>; label: string; variant?: string; prompt?: { key: string; text: string }; confirmText?: string;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function run() {
    if (confirmText && !confirm(confirmText)) return;
    let payload = body;
    if (prompt) { const v = window.prompt(prompt.text); if (v === null) return; payload = { ...body, [prompt.key]: v }; }
    setBusy(true);
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setBusy(false);
    if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? 'خطا');
    router.refresh();
  }
  return <button className={`btn btn-sm ${variant}`} disabled={busy} onClick={run}>{label}</button>;
}
