import { notFound } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import PlanClient from './PlanClient';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getSession();
  const [{ data: plan }, { data: msgs }] = await Promise.all([
    supabase.rpc('outing_plan_detail', { p_plan: params.id }),
    supabase.from('outing_messages').select('id,sender,body,created_at').eq('plan_id', params.id).order('created_at').limit(200),
  ]);
  if (!plan) notFound();
  return <PlanClient plan={plan as any} me={user!.id} initialMsgs={msgs ?? []} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''} />;
}
