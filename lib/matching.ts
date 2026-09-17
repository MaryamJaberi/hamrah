import type { Profile } from './types';

/** 0–99 heuristic: shared interests, complementary languages, city, rating, verification. */
export function matchScore(me: Profile, u: Profile): number {
  let s = 0;
  s += u.interests.filter((i) => me.interests.includes(i)).length * 18;
  if (u.teach_langs.some((l) => me.learn_langs.includes(l))) s += 30;
  if (u.learn_langs.some((l) => me.teach_langs.includes(l))) s += 30;
  if (u.city && u.city === me.city) s += 12;
  if (me.mode !== 'inperson' && u.mode !== 'inperson') s += 6;
  if (u.rating_count > 0) s += (Number(u.rating_avg) - 4) * 8;
  if (u.verified_id) s += 8;
  return Math.max(1, Math.min(99, Math.round(s)));
}
