import 'server-only';
import type { Place } from './outings';

// Free venue search on OpenStreetMap data via the Overpass API (no key, no cost).
// Optional: set GOOGLE_PLACES_KEY to use Google Places (New) instead — paid beyond the free monthly credit.

const OSM_TAGS: Record<string, string[]> = {
  'قهوه': ['amenity=cafe'],
  'شام': ['amenity=restaurant'],
  'صبحانه/برانچ': ['amenity=cafe', 'amenity=restaurant'],
  'پیاده‌روی': ['leisure=park', 'leisure=nature_reserve'],
  'پارک و پیک‌نیک': ['leisure=park', 'leisure=picnic_site'],
  'موزه و گالری': ['tourism=museum', 'tourism=gallery'],
  'سینما': ['amenity=cinema'],
  'کنسرت و موسیقی زنده': ['amenity=theatre', 'amenity=music_venue', 'amenity=arts_centre'],
  'نوشیدنی/بار': ['amenity=bar', 'amenity=pub'],
  'بردگیم': ['leisure=adult_gaming_centre', 'shop=games', 'amenity=cafe'],
  'ورزش': ['leisure=sports_centre', 'leisure=fitness_centre'],
  'خرید و بازارچه': ['amenity=marketplace', 'shop=mall'],
  'کلاس و کارگاه': ['amenity=arts_centre', 'amenity=community_centre'],
  'رقص': ['leisure=dance', 'amenity=nightclub'],
  'کارائوکه': ['amenity=karaoke_box', 'amenity=bar'],
  'دوچرخه‌سواری': ['leisure=park'],
  'سفر یک‌روزه': ['tourism=attraction', 'tourism=viewpoint'],
  'کتاب‌فروشی و کتابخانه': ['shop=books', 'amenity=library'],
};

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

export type Hint = { prefer_alcohol_free?: boolean; smokers_present?: boolean };

export async function searchPlaces(lat: number, lng: number, activity: string, radiusKm = 3, hint: Hint = {}): Promise<Place[]> {
  if (process.env.GOOGLE_PLACES_KEY) {
    try { return await googlePlaces(lat, lng, activity, radiusKm); } catch { /* fall back to OSM */ }
  }
  let tags = OSM_TAGS[activity] ?? ['amenity=cafe'];
  if (hint.prefer_alcohol_free) tags = tags.filter((t) => !['amenity=bar', 'amenity=pub', 'amenity=nightclub'].includes(t));
  if (!tags.length) tags = ['amenity=cafe'];
  const r = Math.min(Math.max(radiusKm, 0.5), 15) * 1000;
  const parts = tags.map((t) => { const [k, v] = t.split('='); return `nwr["${k}"="${v}"]["name"](around:${r},${lat},${lng});`; }).join('');
  const q = `[out:json][timeout:20];(${parts});out center 60;`;

  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep, {
        method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Hamrah/1.0 (outings)' },
        next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      const places: Place[] = (json.elements ?? []).map((e: any) => {
        const t = e.tags ?? {};
        const plat = e.lat ?? e.center?.lat, plng = e.lon ?? e.center?.lon;
        const addr = [t['addr:street'] && `${t['addr:street']} ${t['addr:housenumber'] ?? ''}`.trim(), t['addr:city']].filter(Boolean).join('، ');
        const extra: string[] = [];
        if (t.outdoor_seating === 'yes') extra.push('فضای باز');
        if (t.wheelchair === 'yes') extra.push('ویلچر');
        if (t['diet:vegetarian'] === 'yes' || t['diet:vegan'] === 'yes') extra.push('گیاهی');
        if (t.smoking === 'outside' || t.smoking === 'yes') extra.push('جای سیگار');
        return {
          name: t.name, address: addr || undefined, lat: plat, lng: plng, provider: 'osm' as const,
          kind: t.amenity ?? t.leisure ?? t.tourism ?? t.shop,
          url: t.website?.startsWith('https://') ? t.website : `https://www.openstreetmap.org/${e.type}/${e.id}`,
          tags: extra,
        };
      }).filter((p: Place) => p.name && p.lat && p.lng);
      const scored = places.map((p) => {
        let s = -dist(lat, lng, p.lat, p.lng);
        if (hint.smokers_present && p.tags?.includes('فضای باز')) s += 1;
        if (p.tags?.length) s += 0.3;
        return { p, s };
      });
      const seen = new Set<string>();
      return scored.sort((a, b) => b.s - a.s).map((x) => x.p)
        .filter((p) => (seen.has(p.name) ? false : (seen.add(p.name), true))).slice(0, 20);
    } catch { /* try next mirror */ }
  }
  return photon(lat, lng, tags);
}

/** Last fallback: Photon (also OpenStreetMap data, free). Less detail than Overpass, but a different server. */
async function photon(lat: number, lng: number, tags: string[]): Promise<Place[]> {
  const out: Place[] = [];
  for (const t of tags.slice(0, 2)) {
    const [k, v] = t.split('=');
    try {
      const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(v.replace('_', ' '))}&lat=${lat}&lon=${lng}&osm_tag=${k}:${v}&limit=15&zoom=14&location_bias_scale=0.2`,
        { signal: AbortSignal.timeout(8000), next: { revalidate: 60 * 60 * 6 } });
      if (!r.ok) continue;
      const j = await r.json();
      for (const f of j.features ?? []) {
        const pr = f.properties ?? {}; const [plng, plat] = f.geometry?.coordinates ?? [];
        if (!pr.name || dist(lat, lng, plat, plng) > 6) continue;
        out.push({ name: pr.name, lat: plat, lng: plng, provider: 'osm', kind: v,
          address: [pr.street && `${pr.street} ${pr.housenumber ?? ''}`.trim(), pr.city].filter(Boolean).join('، ') || undefined,
          url: `https://www.openstreetmap.org/${({ N: 'node', W: 'way', R: 'relation' } as Record<string, string>)[pr.osm_type] ?? 'node'}/${pr.osm_id}` });
      }
    } catch { /* ignore */ }
  }
  return out.sort((a, b) => dist(lat, lng, a.lat, a.lng) - dist(lat, lng, b.lat, b.lng)).slice(0, 20);
}

function dist(a: number, b: number, c: number, d: number) {
  const R = 6371, dLat = ((c - a) * Math.PI) / 180, dLng = ((d - b) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function googlePlaces(lat: number, lng: number, activity: string, radiusKm: number): Promise<Place[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'X-Goog-Api-Key': process.env.GOOGLE_PLACES_KEY!,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.primaryType',
    },
    body: JSON.stringify({ textQuery: activity, languageCode: 'fa', maxResultCount: 15,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusKm * 1000, 50000) } } }),
  });
  if (!res.ok) throw new Error('google ' + res.status);
  const j = await res.json();
  return (j.places ?? []).map((p: any) => ({
    name: p.displayName?.text, address: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude,
    url: p.googleMapsUri, provider: 'google' as const, kind: p.primaryType,
  }));
}
