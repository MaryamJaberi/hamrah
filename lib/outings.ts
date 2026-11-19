// Shared constants + types for the «بریم بیرون» (outings) module. Safe on client and server.

export const OUT_ACTIVITIES = [
  ['قهوه', '☕'], ['شام', '🍽️'], ['صبحانه/برانچ', '🥐'], ['پیاده‌روی', '🚶‍♀️'], ['پارک و پیک‌نیک', '🧺'],
  ['موزه و گالری', '🖼️'], ['سینما', '🎬'], ['کنسرت و موسیقی زنده', '🎶'], ['نوشیدنی/بار', '🍷'],
  ['بردگیم', '🎲'], ['ورزش', '🏸'], ['خرید و بازارچه', '🛍️'], ['کلاس و کارگاه', '🎨'], ['رقص', '💃'],
  ['کارائوکه', '🎤'], ['دوچرخه‌سواری', '🚲'], ['سفر یک‌روزه', '🚆'], ['کتاب‌فروشی و کتابخانه', '📚'],
] as const;
export const ACTIVITY_NAMES = OUT_ACTIVITIES.map(([n]) => n) as string[];
export const activityIcon = (a: string) => OUT_ACTIVITIES.find(([n]) => n === a)?.[1] ?? '✨';

export const OUT_HOBBIES = [
  'کتاب', 'فیلم و سریال', 'موسیقی', 'آشپزی', 'یوگا', 'ورزش', 'سفر', 'عکاسی', 'نقاشی و هنر', 'بازی ویدیویی',
  'بردگیم', 'رقص', 'طبیعت‌گردی', 'زبان‌آموزی', 'تکنولوژی', 'روانشناسی', 'فلسفه', 'تاریخ', 'مد و لباس',
  'گیاه و باغبانی', 'حیوانات', 'شعر', 'مافیا', 'تئاتر', 'کار داوطلبانه',
];
export const OUT_LANGS = ['فارسی', 'انگلیسی', 'هلندی', 'آلمانی', 'فرانسوی', 'ترکی', 'عربی', 'اسپانیایی'];

export const DAYS = [['sat', 'شنبه'], ['sun', 'یکشنبه'], ['mon', 'دوشنبه'], ['tue', 'سه‌شنبه'], ['wed', 'چهارشنبه'], ['thu', 'پنجشنبه'], ['fri', 'جمعه']] as const;
export const PARTS = [['morning', 'صبح'], ['afternoon', 'بعدازظهر'], ['evening', 'عصر'], ['night', 'شب']] as const;

export const VIS_OPTS = [['public', 'همه ببینند'], ['matched', 'فقط هم‌برنامه‌ها'], ['hidden', 'هیچ‌کس']] as const;
export type Vis = 'public' | 'matched' | 'hidden';
export type Use = 'no' | 'sometimes' | 'yes';
export const USE_OPTS = [['no', 'نه'], ['sometimes', 'گاهی'], ['yes', 'آره']] as const;
export const LIFESTYLE = [['alcohol', 'الکل', '🍷'], ['cannabis', 'ماریجوانا', '🌿'], ['smoking', 'سیگار', '🚬']] as const;
export type LifestyleKey = (typeof LIFESTYLE)[number][0];

export type OutingProfile = {
  user_id: string; birth_year: number | null; gender: 'woman' | 'man' | 'other' | 'prefer_not' | null;
  job: string | null; hobbies: string[]; activities: string[]; places_liked: string[]; places_been: string[];
  languages: string[]; budget: 'low' | 'mid' | 'high' | null; area_label: string | null;
  area_lat: number | null; area_lng: number | null; radius_km: number; free_slots: string[];
  vis: { age?: Vis; job?: Vis; hobbies?: Vis; places?: Vis };
  pref: { age_min?: number; age_max?: number; women_only?: boolean; avoid?: Partial<Record<LifestyleKey, boolean>> };
  builder_step: number;
};
export type Lifestyle = {
  alcohol: Use | null; cannabis: Use | null; smoking: Use | null;
  alcohol_share: 'hidden' | 'mutual'; cannabis_share: 'hidden' | 'mutual'; smoking_share: 'hidden' | 'mutual';
  use_for_matching: boolean;
};

/** Masked card returned by the outing_card RPC. Missing keys = hidden from you. */
export type OutCard = {
  id: string; name: string; avatar: string; city: string; verified_id: boolean; rating_avg: number; rating_count: number;
  together: boolean; activities?: string[]; languages?: string[]; area_label?: string | null; budget?: string | null;
  age?: number | null; job?: string | null; hobbies?: string[]; places_liked?: string[]; places_been?: string[];
  score?: number; reasons?: string[];
  // plan member extras
  role?: string; status?: string; plan_activities?: string[]; lifestyle?: Partial<Record<LifestyleKey, Use>>;
};

export type Place = {
  name: string; address?: string; lat: number; lng: number; url?: string;
  provider: 'osm' | 'google' | 'manual'; kind?: string; tags?: string[];
};

/** Round to ~1 km so exact homes are never stored. */
export const roundLoc = (x: number) => Math.round(x * 100) / 100;

export const faNum = (n: number | string) => Number(n).toLocaleString('fa-IR');
export function faDateTime(iso: string) {
  return new Date(iso).toLocaleString('fa-IR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
}

export const ERRORS: Record<string, string> = {
  women_only: 'این برنامه فقط برای خانم‌هاست.',
  women_only_requires_woman: 'گزینهٔ «فقط خانم‌ها» را فقط کسی می‌تواند بزند که در پروفایلش «زن» را انتخاب کرده.',
  women_only_requires_woman_organizer: 'گزینهٔ «فقط خانم‌ها» را فقط کسی می‌تواند بزند که در پروفایلش «زن» را انتخاب کرده.',
  full: 'ظرفیت این برنامه پر شده.', closed: 'این برنامه بسته شده.', not_found: 'این دعوت پیدا نشد.',
  rate_limited: 'امروز زیاد ساختی؛ فردا دوباره امتحان کن.', profile_required: 'اول پروفایل «بریم بیرون» را بساز.',
  past: 'این زمان گذشته است.', not_allowed: 'این کار برای تو ممکن نیست.', forbidden: 'دسترسی نداری.',
};
export const errText = (m?: string) => {
  const k = Object.keys(ERRORS).find((key) => m?.includes(key));
  return k ? ERRORS[k] : 'یه مشکلی پیش اومد. دوباره امتحان کن.';
};

/** Map providers. Default: OpenStreetMap (free, no key). Set NEXT_PUBLIC_MAPTILER_KEY to use MapTiler tiles instead. */
export function tileLayer() {
  const k = process.env.NEXT_PUBLIC_MAPTILER_KEY;
  return k
    ? { url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${k}`, attribution: '© MapTiler © OpenStreetMap contributors' }
    : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' };
}
export const mapsLink = (p: { lat: number; lng: number; name?: string }) =>
  `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
export const directionsLink = (p: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`; // opening a link is free; no API key needed
