'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import './dorehami.css';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { mount, type DhPrefill } from '@/lib/dorehami/engine';

// Dorehami public backend fallback when Vercel environment points to an unmigrated Supabase instance
const DH_FALLBACK_URL = 'https://healdibivptzehahdvig.supabase.co';
const DH_FALLBACK_ANON = 'sb_publishable_PCopQgyzrd2CYNlQihNxDw_7v_PrV65';

function createDorehamiSb() {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (envUrl.includes('healdibivptzehahdvig')) {
    return createClient();
  }
  return createSupabaseClient(DH_FALLBACK_URL, DH_FALLBACK_ANON);
}

export default function DorehamiClient({ user, prefill }: { user: { id: string; name: string } | null; prefill: DhPrefill }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mount(ref.current, { sb: createDorehamiSb(), user, prefill });
  }, [user, prefill]);
  return (
    <div ref={ref}>
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B6B82' }}>…</div>
    </div>
  );
}
