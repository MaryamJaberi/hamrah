import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';

const ALLOWED_CHALLENGES = new Set([
  'weight_journey',
  'adhd',
  'social_anxiety',
  'new_in_town',
  'hard_season',
  'habit_reset',
  'low_energy',
]);

/**
 * POST /api/d/mutual-match
 * Double-blind privacy-preserving matching:
 * Only reveals challenges that BOTH the caller AND the other person selected.
 * Never leaks any non-overlapping private challenge, email, or private contact.
 */
export async function POST(req: Request) {
  try {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (!sbUrl || sbUrl.includes('example.supabase.co')) {
      return NextResponse.json({ matches: [] });
    }

    const body = await req.json().catch(() => ({}));
    const myName = String(body.name ?? '').trim().toLowerCase();
    const myChallenges: string[] = Array.isArray(body.challenges)
      ? Array.from(new Set(body.challenges.filter((c: unknown) => typeof c === 'string' && ALLOWED_CHALLENGES.has(c))))
      : [];
    const myCities = new Set<string>(
      Array.isArray(body.cities) ? body.cities.filter((c: unknown) => typeof c === 'string') : []
    );
    const myHobbies = new Set<string>(
      Array.isArray(body.hobbies) ? body.hobbies.filter((h: unknown) => typeof h === 'string') : []
    );
    const mySmoke = typeof body.smoke === 'string' ? body.smoke : '';
    const myAlcohol = typeof body.alcohol === 'string' ? body.alcohol : '';
    const myPsych = (body.psych && typeof body.psych === 'object' ? body.psych : {}) as Record<string, string>;

    const hasMyPsych = Object.keys(myPsych).length > 0;
    if (!myChallenges.length && !hasMyPsych) {
      return NextResponse.json({ matches: [] });
    }

    const myChallengeSet = new Set(myChallenges);
    const db = admin();
    const { data: rows, error } = await db
      .from('dh_responses')
      .select('name, data, updated_at')
      .order('updated_at', { ascending: false })
      .limit(250);

    if (error) throw error;

    // Deduplicate by lowercase name (latest response wins, merging private_challenges)
    const byPerson = new Map<string, { name: string; data: Record<string, any> }>();
    for (const r of rows ?? []) {
      const cleanName = String(r.name ?? '').trim();
      if (!cleanName || /^تست\b|مهمان/i.test(cleanName)) continue;
      const key = cleanName.toLowerCase();
      if (myName && key === myName) continue;
      const d = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, any>;
      if (!byPerson.has(key)) {
        byPerson.set(key, { name: cleanName, data: { ...d } });
      } else {
        const prev = byPerson.get(key)!;
        prev.data = { ...d, ...prev.data };
      }
    }

    const matches: Array<{
      name: string;
      shared_challenges: string[];
      shared_cities: string[];
      shared_hobbies: string[];
      psych_fit: boolean;
      score: number;
    }> = [];

    for (const person of byPerson.values()) {
      const d = person.data;
      const theirChallenges: string[] = Array.isArray(d.private_challenges)
        ? d.private_challenges.filter((c: unknown) => typeof c === 'string' && ALLOWED_CHALLENGES.has(c))
        : [];

      // Double-blind intersection: ONLY challenges both selected
      const shared_challenges = theirChallenges.filter((c) => myChallengeSet.has(c));

      // Hidden psych compatibility (zero disclosure: never return their psych keys!)
      const theirPsych = (d.psych && typeof d.psych === 'object' ? d.psych : {}) as Record<string, string>;
      let psychOverlap = 0;
      for (const pk of ['social_energy', 'friendship_style', 'focus_rhythm', 'social_lang']) {
        if (myPsych[pk] && theirPsych[pk] && myPsych[pk] === theirPsych[pk]) {
          psychOverlap++;
        }
      }

      // Require either a shared private challenge OR strong psych fit (>= 2 matching hidden dimensions)
      if (!shared_challenges.length && psychOverlap < 2) continue;

      // Boundary compatibility check (avoid hard smoke/alcohol clashes)
      if (mySmoke === 'bothers' && d.smoke === 'smoke') continue;
      if (d.smoke === 'bothers' && mySmoke === 'smoke') continue;
      if (myAlcohol === 'none_place' && d.alcohol === 'drink') continue;
      if (d.alcohol === 'none_place' && myAlcohol === 'drink') continue;

      const theirCities = new Set<string>([
        ...(Array.isArray(d.can_cities) ? d.can_cities : []),
        ...(d.origin?.key ? [d.origin.key] : []),
      ]);
      const shared_cities = Array.from(theirCities).filter((c) => myCities.has(c));

      const theirHobbies: string[] = [
        ...(Array.isArray(d.hobbies) ? d.hobbies : []),
        ...(Array.isArray(d.activities) ? d.activities : []),
      ];
      const shared_hobbies = Array.from(new Set(theirHobbies.filter((h) => myHobbies.has(h))));

      const score =
        shared_challenges.length * 40 +
        psychOverlap * 18 +
        shared_cities.length * 25 +
        shared_hobbies.length * 10;
      matches.push({
        name: person.name,
        shared_challenges,
        shared_cities,
        shared_hobbies,
        psych_fit: psychOverlap >= 1,
        score,
      });
    }

    matches.sort((a, b) => b.score - a.score);
    return NextResponse.json({ matches: matches.slice(0, 10) });
  } catch (err: any) {
    console.error('Error in /api/d/mutual-match:', err);
    return NextResponse.json({ error: 'match_failed' }, { status: 500 });
  }
}
