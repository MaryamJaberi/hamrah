import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { searchPlaces, type Hint } from '@/lib/places';

/** GET /api/out/places?lat=&lng=&activity=&r=&plan= — free venue suggestions (OpenStreetMap). */
export async function GET(req: Request) {
  const { supabase, error } = await requireUser();
  if (error) return error;
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get('lat')), lng = Number(u.searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'bad location' }, { status: 400 });
  }
  const activity = (u.searchParams.get('activity') ?? 'قهوه').slice(0, 40);
  const r = Math.min(Number(u.searchParams.get('r') ?? 3) || 3, 15);
  let hint: Hint = {};
  const plan = u.searchParams.get('plan');
  if (plan) {
    // the hint comes from the DB and only exists for members of plans with ≥3 people
    const { data } = await supabase.rpc('outing_plan_detail', { p_plan: plan });
    hint = (data as any)?.venue_hint ?? {};
  }
  const places = await searchPlaces(lat, lng, activity, r, hint);
  return NextResponse.json({ places, provider: process.env.GOOGLE_PLACES_KEY ? 'google' : 'osm' });
}
