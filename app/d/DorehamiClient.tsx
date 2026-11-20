'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import './dorehami.css';
import { createClient } from '@/lib/supabase/client';
import { mount, type DhPrefill } from '@/lib/dorehami/engine';

export default function DorehamiClient({ user, prefill }: { user: { id: string; name: string } | null; prefill: DhPrefill }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    return mount(ref.current, { sb: createClient(), user, prefill });
  }, [user, prefill]);
  return (
    <div ref={ref}>
      <div style={{ padding: '60px 0', textAlign: 'center', color: '#6B6B82' }}>…</div>
    </div>
  );
}
