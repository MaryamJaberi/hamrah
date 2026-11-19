import { notFound } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import IntentClient from './IntentClient';

export const dynamic = 'force-dynamic';

export default async function IntentPage({ params }: { params: { id: string } }) {
  const { supabase } = await getSession();
  const { data } = await supabase.rpc('outing_intent_detail', { p_intent: params.id });
  if (!data) notFound();
  return <IntentClient i={data as any} />;
}
