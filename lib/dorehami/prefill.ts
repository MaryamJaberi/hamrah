// Builds «دورهمی» form answers from a member's Hamrah profile, so signed-in people don't retype everything.
// Only fills things the person already told Hamrah; every value stays editable in the form.
import type { Lifestyle, OutingProfile } from '@/lib/outings';

const LANG: Record<string, string> = { 'فارسی': 'fa', 'انگلیسی': 'en', 'هلندی': 'nl', 'ترکی': 'tr', 'عربی': 'ar' };
const BUDGET: Record<string, number> = { low: 1, mid: 2, high: 3 };

function ageRange(birth: number | null | undefined): string | undefined {
  if (!birth) return undefined;
  const a = new Date().getFullYear() - birth;
  if (a < 25) return 'زیر ۲۵';
  if (a < 30) return '۲۵–۳۰';
  if (a < 35) return '۳۰–۳۵';
  if (a < 40) return '۳۵–۴۰';
  if (a < 50) return '۴۰–۵۰';
  return '۵۰+';
}

type Saved = { name: string | null; data: Record<string, unknown> | null; public_fields: string[] | null } | null;

// `saved` = the member's answers from their last «دورهمی» (021). They win over the profile and switch the form to quick mode.
export function buildPrefill(name: string | null | undefined, op: Partial<OutingProfile> | null, ls: Partial<Lifestyle> | null, saved: Saved = null) {
  const d: Record<string, unknown> = {};
  if (op) {
    if (op.area_lat != null && op.area_lng != null) {
      d.origin = { key: 'geo', fa: op.area_label || 'محدودهٔ من', lat: Number(op.area_lat), lng: Number(op.area_lng), station: false };
    }
    if (op.job) d.job = op.job;
    if (op.hobbies?.length) d.hobbies = op.hobbies.slice(0, 20);
    const langs = (op.languages ?? []).map((l) => LANG[l]).filter(Boolean);
    if (langs.length) d.langs = langs;
    if (op.budget && BUDGET[op.budget]) d.budget = BUDGET[op.budget];
    const age = ageRange(op.birth_year);
    if (age) d.age = age;
  }
  // Hamrah stores "do you use it"; دورهمی asks "are you OK with it around you". Only map what is unambiguous.
  if (ls) {
    if (ls.alcohol === 'yes' || ls.alcohol === 'sometimes') d.alcohol = 'drink';
    if (ls.smoking === 'yes' || ls.smoking === 'sometimes') d.smoke = 'smoke';
    if (ls.cannabis === 'yes' || ls.cannabis === 'sometimes') d.weed = 'use';
  }
  if (saved?.data && Object.keys(saved.data).length) {
    return { name: saved.name || name || '', data: { ...d, ...saved.data }, pub: saved.public_fields ?? [], saved: true };
  }
  if (!name && !Object.keys(d).length) return null;
  return { name: name ?? '', data: d, saved: false };
}
