import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { admin } from '@/lib/supabase/admin';
import { roundLoc } from '@/lib/outings';

export async function POST(req: Request) {
  const { supabase, user, error } = await requireUser();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const planId = String(body.planId ?? '');
  const areaLabel = typeof body.areaLabel === 'string' ? body.areaLabel.trim().slice(0, 80) : '';
  const lat = typeof body.lat === 'number' && Number.isFinite(body.lat) ? roundLoc(body.lat) : null;
  const lng = typeof body.lng === 'number' && Number.isFinite(body.lng) ? roundLoc(body.lng) : null;
  const freeSlots = Array.isArray(body.freeSlots)
    ? body.freeSlots.filter((x: unknown): x is string => typeof x === 'string').slice(0, 28)
    : [];
  const activities = Array.isArray(body.activities)
    ? body.activities.filter((x: unknown): x is string => typeof x === 'string').slice(0, 10)
    : [];

  if (!planId) return NextResponse.json({ error: 'bad_input' }, { status: 400 });

  // Verify the caller is a member of this plan via RLS-safe RPC
  const { data: detail } = await supabase.rpc('outing_plan_detail', { p_plan: planId });
  if (!detail) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // 1. Try the 012 RPC first (if migration 012 is applied)
  await supabase.rpc('set_outing_member_prefs', {
    p_plan: planId,
    p_area_label: areaLabel || null,
    p_lat: lat,
    p_lng: lng,
    p_free_slots: freeSlots,
    p_activities: activities,
  });

  // 2. Ensure outing_plan_members and outing_profiles are updated even before 012 is applied in SQL editor
  const db = admin();
  const memberPatch: Record<string, unknown> = {
    activities,
  };
  if (lat !== null && lng !== null) {
    memberPatch.area_lat = lat;
    memberPatch.area_lng = lng;
  }
  await db.from('outing_plan_members').update(memberPatch).eq('plan_id', planId).eq('user_id', user.id);

  // Also try updating area_label & free_slots on outing_plan_members if columns exist
  await db
    .from('outing_plan_members')
    .update({ area_label: areaLabel || null, free_slots: freeSlots })
    .eq('plan_id', planId)
    .eq('user_id', user.id)
    .then(() => null, () => null);

  // Update the user's own outing_profiles so their area & free_slots persist for matching
  const { data: existingOp } = await db
    .from('outing_profiles')
    .select('user_id,activities')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingOp) {
    const profilePatch: Record<string, unknown> = {
      free_slots: freeSlots,
      updated_at: new Date().toISOString(),
    };
    if (areaLabel) profilePatch.area_label = areaLabel;
    if (lat !== null && lng !== null) {
      profilePatch.area_lat = lat;
      profilePatch.area_lng = lng;
    }
    if (activities.length > 0 && (!existingOp.activities || existingOp.activities.length === 0)) {
      profilePatch.activities = activities;
    }
    await db.from('outing_profiles').update(profilePatch).eq('user_id', user.id);
  } else {
    await db.from('outing_profiles').insert({
      user_id: user.id,
      area_label: areaLabel || null,
      area_lat: lat,
      area_lng: lng,
      free_slots: freeSlots,
      activities,
    });
  }

  return NextResponse.json({ ok: true });
}
