import { NextResponse } from 'next/server';
import { venuesNear } from '@/lib/dorehami/venues';

export const preferredRegion = 'fra1'; // close to the Netherlands and to the European OSM servers
export const maxDuration = 60;

// Public (guests use «دورهمی» without an account). Only accepts coordinates inside the Netherlands/Belgium box,
// rounded to ~100 m so every visitor of the same hub hits the same cache entry.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Math.round(Number(u.searchParams.get('lat')) * 1000) / 1000;
  const lng = Math.round(Number(u.searchParams.get('lng')) * 1000) / 1000;
  if (!(lat > 49.4 && lat < 53.7 && lng > 2.5 && lng < 7.3)) return NextResponse.json({ error: 'bad_location' }, { status: 400 });
  const data = await venuesNear(lat, lng);
  return NextResponse.json(data, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
}
