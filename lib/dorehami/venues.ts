import 'server-only';

// Cafés and restaurants near a station, with the diet/access tags «دورهمی» ranks by.
// Runs on the server (not in the guest's browser): one request per hub, cached 6 h, three Overpass mirrors,
// then Photon as a last resort. All OpenStreetMap data, free, no key.

export type Venue = {
  name: string; lat: number; lng: number; amenity: string; cuisine: string; street: string; website?: string;
  halal?: string; vegetarian?: string; vegan?: string; wheelchair?: string; outdoor?: string; osm: string;
};

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function venuesNear(lat: number, lng: number, radius = 1100): Promise<{ venues: Venue[]; source: string }> {
  const q = `[out:json][timeout:25];nwr(around:${radius},${lat},${lng})["amenity"~"^(cafe|restaurant)$"]["name"];out center tags 150;`;
  for (const ep of MIRRORS) {
    try {
      // GET so Next can cache the response per hub
      const res = await fetch(`${ep}?data=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Hamrah/1.0 (dorehami; contact via github.com/MaryamJaberi)' },
        next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const j = await res.json();
      const venues: Venue[] = (j.elements ?? []).map((e: any) => {
        const t = e.tags ?? {};
        return {
          name: t.name, lat: e.lat ?? e.center?.lat, lng: e.lon ?? e.center?.lon, amenity: t.amenity, cuisine: t.cuisine ?? '',
          street: [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' '),
          website: t.website ?? t['contact:website'], halal: t['diet:halal'], vegetarian: t['diet:vegetarian'], vegan: t['diet:vegan'],
          wheelchair: t.wheelchair, outdoor: t.outdoor_seating, osm: `${e.type}/${e.id}`,
        };
      }).filter((v: Venue) => v.name && v.lat && v.lng);
      if (venues.length) return { venues, source: 'overpass' };
    } catch { /* next mirror */ }
  }
  return { venues: await photon(lat, lng), source: 'photon' };
}

async function photon(lat: number, lng: number): Promise<Venue[]> {
  const out: Venue[] = [];
  for (const [k, v] of [['amenity', 'restaurant'], ['amenity', 'cafe']]) {
    try {
      const r = await fetch(`https://photon.komoot.io/api/?q=${v}&lat=${lat}&lon=${lng}&osm_tag=${k}:${v}&limit=25&zoom=15&location_bias_scale=0.1`,
        { signal: AbortSignal.timeout(8000), next: { revalidate: 60 * 60 * 6 } });
      if (!r.ok) continue;
      const j = await r.json();
      for (const f of j.features ?? []) {
        const p = f.properties ?? {}; const [plng, plat] = f.geometry?.coordinates ?? [];
        if (!p.name || !plat) continue;
        out.push({ name: p.name, lat: plat, lng: plng, amenity: v, cuisine: '', street: [p.street, p.housenumber].filter(Boolean).join(' '),
          osm: `${({ N: 'node', W: 'way', R: 'relation' } as Record<string, string>)[p.osm_type] ?? 'node'}/${p.osm_id}` });
      }
    } catch { /* ignore */ }
  }
  return out;
}
