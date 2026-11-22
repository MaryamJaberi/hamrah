import 'server-only';

// Cafés and restaurants near a station, with the diet/access tags «دورهمی» ranks by.
// Runs on the server (not in the guest's browser), cached 6 h per hub. Order:
//   1. Geoapify Places, if GEOAPIFY_KEY is set (free tier: 3,000 requests/day, no credit card; OpenStreetMap data
//      with halal/vegetarian/vegan/wheelchair filters). Public Overpass servers are often overloaded or refuse cloud IPs.
//   2. Three public Overpass mirrors.  3. Photon (names only, no diet tags).

export type Venue = {
  name: string; lat: number; lng: number; amenity: string; cuisine: string; street: string; website?: string;
  halal?: string; vegetarian?: string; vegan?: string; wheelchair?: string; outdoor?: string; osm: string;
};

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function venuesNear(lat: number, lng: number, radius = 1100): Promise<{ venues: Venue[]; source: string; tried: string[] }> {
  const tried: string[] = [];
  if (process.env.GEOAPIFY_KEY) {
    try {
      const v = await geoapify(lat, lng, radius);
      if (v.length) return { venues: v, source: 'geoapify', tried };
      tried.push('geoapify: empty');
    } catch (e) { tried.push(`geoapify: ${(e as Error).message}`); }
  }
  const q = `[out:json][timeout:25];nwr(around:${radius},${lat},${lng})["amenity"~"^(cafe|restaurant)$"]["name"];out center tags 150;`;
  for (const ep of MIRRORS) {
    try {
      // GET so Next can cache the response per hub
      const res = await fetch(`${ep}?data=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Hamrah/1.0 (dorehami; contact via github.com/MaryamJaberi)' },
        next: { revalidate: 60 * 60 * 6 }, signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { tried.push(`${new URL(ep).host}: ${res.status}`); continue; }
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
      if (venues.length) return { venues, source: 'overpass', tried };
      tried.push(`${new URL(ep).host}: empty`);
    } catch (e) { tried.push(`${new URL(ep).host}: ${(e as Error).name}`); }
  }
  return { venues: await photon(lat, lng), source: 'photon', tried };
}

async function geoapify(lat: number, lng: number, radius: number): Promise<Venue[]> {
  const u = `https://api.geoapify.com/v2/places?categories=catering.restaurant,catering.cafe&filter=circle:${lng},${lat},${radius}`
    + `&bias=proximity:${lng},${lat}&limit=120&apiKey=${process.env.GEOAPIFY_KEY}`;
  const r = await fetch(u, { signal: AbortSignal.timeout(12000), next: { revalidate: 60 * 60 * 6 } });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return (j.features ?? []).map((f: any) => {
    const p = f.properties ?? {}; const raw = p.datasource?.raw ?? {}; const cats: string[] = p.categories ?? [];
    const has = (c: string) => cats.includes(c) ? 'yes' : undefined;
    const cuisineCat = cats.find((c) => c.startsWith('catering.restaurant.') || c.startsWith('catering.cafe.'));
    return {
      name: p.name, lat: p.lat, lng: p.lon, amenity: cats.includes('catering.cafe') ? 'cafe' : 'restaurant',
      cuisine: raw.cuisine ?? (cuisineCat ? cuisineCat.split('.').pop() : ''),
      street: [p.street, p.housenumber].filter(Boolean).join(' '), website: p.website ?? raw.website,
      halal: raw['diet:halal'] ?? has('halal'), vegetarian: raw['diet:vegetarian'] ?? has('vegetarian'), vegan: raw['diet:vegan'] ?? has('vegan'),
      wheelchair: raw.wheelchair ?? (cats.includes('wheelchair.yes') ? 'yes' : undefined), outdoor: raw.outdoor_seating,
      osm: raw.osm_type && raw.osm_id ? `${({ n: 'node', w: 'way', r: 'relation' } as Record<string, string>)[raw.osm_type] ?? 'node'}/${raw.osm_id}` : '',
    } as Venue;
  }).filter((v: Venue) => v.name && v.lat && v.lng);
}

/** Photon matches names, so search a few words and keep only places within ~2 km of the hub. */
async function photon(lat: number, lng: number): Promise<Venue[]> {
  const out: Venue[] = [];
  const seen = new Set<string>();
  for (const [k, v, q] of [['amenity', 'restaurant', 'restaurant'], ['amenity', 'cafe', 'cafe'], ['amenity', 'cafe', 'koffie'], ['amenity', 'restaurant', 'eten']]) {
    try {
      const r = await fetch(`https://photon.komoot.io/api/?q=${q}&lat=${lat}&lon=${lng}&osm_tag=${k}:${v}&limit=40&zoom=16&location_bias_scale=0.05`,
        { signal: AbortSignal.timeout(8000), next: { revalidate: 60 * 60 * 6 } });
      if (!r.ok) continue;
      const j = await r.json();
      for (const f of j.features ?? []) {
        const p = f.properties ?? {}; const [plng, plat] = f.geometry?.coordinates ?? [];
        if (!p.name || !plat || seen.has(p.name) || km(lat, lng, plat, plng) > 2.5) continue;
        seen.add(p.name);
        out.push({ name: p.name, lat: plat, lng: plng, amenity: v, cuisine: '', street: [p.street, p.housenumber].filter(Boolean).join(' '),
          osm: `${({ N: 'node', W: 'way', R: 'relation' } as Record<string, string>)[p.osm_type] ?? 'node'}/${p.osm_id}` });
      }
    } catch { /* ignore */ }
  }
  return out;
}

function km(a: number, b: number, c: number, d: number) {
  const R = 6371, x = ((c - a) * Math.PI) / 180, y = ((d - b) * Math.PI) / 180;
  const h = Math.sin(x / 2) ** 2 + Math.cos((a * Math.PI) / 180) * Math.cos((c * Math.PI) / 180) * Math.sin(y / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
