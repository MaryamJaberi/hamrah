import { notFound } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';
import { admin } from '@/lib/supabase/admin';
import { roundLoc } from '@/lib/outings';
import PlanClient from './PlanClient';

export const dynamic = 'force-dynamic';

export default async function PlanPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getSession();
  const [{ data: rawPlan }, { data: msgs }] = await Promise.all([
    supabase.rpc('outing_plan_detail', { p_plan: params.id }),
    supabase.from('outing_messages').select('id,sender,body,created_at').eq('plan_id', params.id).order('created_at').limit(200),
  ]);
  if (!rawPlan) notFound();

  const plan = rawPlan as any;
  const joinedMembers: any[] = (plan.members ?? []).filter((m: any) => m.status === 'joined');
  const joinedIds = joinedMembers.map((m) => m.id);

  // Enrich with member availability windows & midpoint center (works with or before migration 012)
  if (joinedIds.length > 0 && (!plan.suggested_windows || !plan.my_prefs)) {
    const db = admin();
    const [{ data: memRows }, { data: profRows }] = await Promise.all([
      db.from('outing_plan_members').select('*').eq('plan_id', params.id).in('user_id', joinedIds),
      db.from('outing_profiles').select('user_id,area_label,area_lat,area_lng,free_slots,activities').in('user_id', joinedIds),
    ]);
    const memById = new Map((memRows ?? []).map((r: any) => [r.user_id, r]));
    const profById = new Map((profRows ?? []).map((r: any) => [r.user_id, r]));

    const slotCounts = new Map<string, { count: number; names: string[] }>();
    let sumLat = 0, sumLng = 0, locCount = 0;

    for (const m of joinedMembers) {
      const mr: any = memById.get(m.id);
      const pr: any = profById.get(m.id);
      const lat = mr?.area_lat ?? pr?.area_lat ?? null;
      const lng = mr?.area_lng ?? pr?.area_lng ?? null;
      const slots: string[] = (mr?.free_slots?.length ? mr.free_slots : pr?.free_slots) ?? [];
      if (lat != null && lng != null) {
        sumLat += Number(lat);
        sumLng += Number(lng);
        locCount++;
      }
      for (const s of slots) {
        const cur = slotCounts.get(s) ?? { count: 0, names: [] };
        cur.count++;
        cur.names.push(m.name);
        slotCounts.set(s, cur);
      }
      m.has_prefs = lat != null || slots.length > 0 || (mr?.activities?.length ?? 0) > 0;
    }

    plan.suggested_windows = [...slotCounts.entries()]
      .map(([slot, v]) => ({ slot, count: v.count, names: v.names }))
      .sort((a, b) => b.count - a.count || a.slot.localeCompare(b.slot))
      .slice(0, 6);

    if (locCount > 0) {
      plan.center = { lat: roundLoc(sumLat / locCount), lng: roundLoc(sumLng / locCount), count: locCount };
    }

    const myMem: any = memById.get(user!.id);
    const myProf: any = profById.get(user!.id);
    const mySlots: string[] = (myMem?.free_slots?.length ? myMem.free_slots : myProf?.free_slots) ?? [];
    const myActs: string[] = (myMem?.activities?.length ? myMem.activities : myProf?.activities) ?? [];
    const myLat = myMem?.area_lat ?? myProf?.area_lat ?? null;
    const myLng = myMem?.area_lng ?? myProf?.area_lng ?? null;
    plan.my_prefs = {
      area_label: myMem?.area_label ?? myProf?.area_label ?? '',
      area_lat: myLat != null ? Number(myLat) : null,
      area_lng: myLng != null ? Number(myLng) : null,
      free_slots: mySlots,
      activities: myActs,
      checked_in: myLat != null || mySlots.length > 0 || (myMem?.activities?.length ?? 0) > 0,
    };
  }

  return <PlanClient plan={plan} me={user!.id} initialMsgs={msgs ?? []} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''} />;
}
