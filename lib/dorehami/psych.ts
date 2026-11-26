/**
 * Free, short, science-inspired self-discovery micro-tests (inspired by psychology wiki assessments)
 * and privacy-preserving compatibility scoring for Hamrah (/d).
 *
 * PRIVACY CONTRACT:
 * - All test results live in `profile.data.psych` and are NEVER placed in `public_fields`.
 * - `GET /api/d/profiles` strips `psych` and `private_challenges` from all public responses.
 * - Compatibility badges only show aggregate warmth ("هم‌خوانی بالا") without revealing
 *   anyone else's hidden traits or vulnerabilities.
 */

export type PsychQuizKey = 'social_energy' | 'friendship_style' | 'focus_rhythm' | 'social_lang';

export interface PsychOption {
  value: string;
  label: string;
}

export interface PsychQuestion {
  q: string;
  options: PsychOption[];
}

export interface PsychTraitInfo {
  title: string;
  short: string;
  desc: string;
  tip: string;
}

export interface PsychQuiz {
  key: PsychQuizKey;
  icon: string;
  title: string;
  subtitle: string;
  sourceNote: string;
  questions: PsychQuestion[];
  traits: Record<string, PsychTraitInfo>;
}

export const PSYCH_QUIZZES: PsychQuiz[] = [
  {
    key: 'social_energy',
    icon: '🔋',
    title: 'تست انرژی اجتماعی (درون‌گرا / برون‌گرا)',
    subtitle: 'بر پایهٔ شاخص برون‌گرایی Big Five — فقط ۳ سؤال',
    sourceNote: 'الهام‌گرفته از آزمون شخصیت ۵ عاملی (Big Five)',
    questions: [
      {
        q: 'بعد از یک هفتهٔ شلوغ، کدام قرار حالت را بهتر می‌کند؟',
        options: [
          { value: 'introvert', label: '☕ یک گپ آرام دونفره یا پیاده‌روی خلوت' },
          { value: 'ambivert', label: '🌿 یک جمع کوچک ۳ تا ۵ نفرهٔ صمیمی' },
          { value: 'extrovert', label: '🎉 یک دورهمی پرانرژی و آشنایی با آدم‌های تازه' },
        ],
      },
      {
        q: 'در یک جمع جدید معمولاً چطور انرژی می‌گیری؟',
        options: [
          { value: 'introvert', label: '🎧 بیشتر گوش می‌دهم و با یک نفر عمیق‌تر حرف می‌زنم' },
          { value: 'ambivert', label: '🙂 بستگی به حس‌وحال جمع دارد؛ کم‌کم گرم می‌شوم' },
          { value: 'extrovert', label: '🗣️ خیلی زود سر صحبت را باز می‌کنم و انرژی می‌گیرم' },
        ],
      },
      {
        q: 'بعد از ۲ ساعت معاشرت معمولاً چه حسی داری؟',
        options: [
          { value: 'introvert', label: '🔋 خوشحالم ولی نیاز به استراحت و تنهایی دارم' },
          { value: 'ambivert', label: '⚖️ اگر آدم‌ها هم‌فاز باشند باز هم ادامه می‌دهم' },
          { value: 'extrovert', label: '⚡ تازه شارژ شده‌ام و دوست دارم ادامه بدهیم' },
        ],
      },
    ],
    traits: {
      introvert: {
        title: 'درون‌گرایِ عمیق',
        short: 'جمع‌های کوچک و آرام',
        desc: 'تو در گفتگوهای واقعی و دونفره یا جمع‌های خیلی کوچک بیشترین آرامش و پیوند را تجربه می‌کنی.',
        tip: 'سیستم قرارهای دونفره، کافه‌های آرام و جمع‌های کم‌جمعیت را برایت بالاتر می‌آورد.',
      },
      ambivert: {
        title: 'میان‌گرایِ انعطاف‌پذیر',
        short: 'متعادل و هم‌فاز',
        desc: 'هم از گپ‌های آرام لذت می‌بری و هم در جمع‌های صمیمی و باحال می‌درخشی.',
        tip: 'سیستم هم قرارهای ثابت کوچک و هم دورهمی‌های موضوعی نزدیکت را اولویت می‌دهد.',
      },
      extrovert: {
        title: 'برون‌گرایِ پرانرژی',
        short: 'انرژی از جمع و فعالیت',
        desc: 'معاشرت، بازی گروهی و فعالیت‌های پویا به تو انرژی و انگیزه می‌دهد.',
        tip: 'سیستم دورهمی‌های گروهی، بازی و فعالیت‌های پرانرژی را برایت بالاتر می‌چیند.',
      },
    },
  },
  {
    key: 'friendship_style',
    icon: '🧭',
    title: 'تست سبک دوستی و امنیت عاطفی',
    subtitle: 'بر پایهٔ نظریهٔ دلبستگی بزرگسالان — فقط ۳ سؤال',
    sourceNote: 'الهام‌گرفته از سبک‌های دلبستگی (Attachment Theory)',
    questions: [
      {
        q: 'وقتی با یک دوست تازه آشنا می‌شوی، چه ریتمی برایت امن‌تر است؟',
        options: [
          { value: 'steady_safe', label: '🔄 یک قرار ثابت و قابل‌پیش‌بینی (مثلاً هر هفته یک ساعت مشخص)' },
          { value: 'warm_close', label: '💌 پیام‌دادن‌های گرم و پیگیری مداوم بین قرارها' },
          { value: 'free_space', label: '🍃 فضای آزاد بدون فشارِ پاسخ سریع؛ هر وقت هر دو آماده بودیم' },
        ],
      },
      {
        q: 'اگر دوستی چند روز دیر جواب پیامت را بدهد چه حسی داری؟',
        options: [
          { value: 'steady_safe', label: '🙂 درک می‌کنم مشغله دارد، قرار ثابتمان سر جایش است' },
          { value: 'warm_close', label: '💭 کمی نگران می‌شوم و دوست دارم شفاف بگوید همه چیز خوب است' },
          { value: 'free_space', label: '😌 اصلاً مشکلی نیست؛ خودم هم گاهی دیر جواب می‌دهم' },
        ],
      },
      {
        q: 'چه چیزی بیشتر از همه به تو حس امنیت در دوستی می‌دهد؟',
        options: [
          { value: 'steady_safe', label: '🤝 خوش‌قولی و تکرار آرامِ دیدارها' },
          { value: 'warm_close', label: '💛 صمیمیت، همدلی و اشتراک احساسات واقعی' },
          { value: 'free_space', label: '🕊️ احترام به مرزها و نداشتن توقع و قضاوت' },
        ],
      },
    ],
    traits: {
      steady_safe: {
        title: 'دوستیِ امن و پایدار',
        short: 'قرارهای ثابت و خوش‌قول',
        desc: 'ثبات، شفافیت و تکرارِ منظم دیدارها کلید آرامش و شکل‌گیری اعتماد در توست.',
        tip: 'سیستم قرارهای هفتگی و دوهفته‌ای با ریتم مشخص را در اولویتت می‌گذارد.',
      },
      warm_close: {
        title: 'دوستیِ صمیمی و همدل',
        short: 'همدلی و ارتباط گرم',
        desc: 'برای تو گرما، صداقت و حس دیده‌شدن در رابطه اهمیت زیادی دارد.',
        tip: 'سیستم افراد و جمع‌هایی با فضای همدل و بدون قضاوت را برایت اولویت‌بندی می‌کند.',
      },
      free_space: {
        title: 'دوستیِ آزاد و کم‌فشار',
        short: 'بدون فشار و توقع',
        desc: 'رابطه‌هایی که بدون عذاب‌وجدان و فشارِ پاسخ‌گویی دائمی پیش می‌روند برایت بهترین‌اند.',
        tip: 'سیستم هم‌مسیرهایی با ریتم کم‌فشار و بدون قضاوت را برایت بالاتر می‌آورد.',
      },
    },
  },
  {
    key: 'focus_rhythm',
    icon: '🧠',
    title: 'تست سبک تمرکز و شروع کارها',
    subtitle: 'آیا بادی‌دبلینگ (همراهی در کار) برایت معجزه می‌کند؟ — ۳ سؤال',
    sourceNote: 'الهام‌گرفته از الگوهای کارکرد اجرایی و ADHD-friendly',
    questions: [
      {
        q: 'وقتی کار یا ورزش مهمی داری، کدام حالت باعث می‌شود واقعاً انجامش بدهی؟',
        options: [
          { value: 'body_double', label: '👯‍♀️ وقتی یک نفر کنارم باشد یا با هم قرار بگذاریم (بادی‌دبلینگ)' },
          { value: 'gentle_pace', label: '🌿 وقتی فشار نباشد و با ریتم آرام و انعطاف‌پذیر پیش بروم' },
          { value: 'structured', label: '📅 وقتی ساعت و برنامهٔ دقیق در تقویمم مشخص باشد' },
        ],
      },
      {
        q: 'در قرارهای دوستانه چه چیزی بیشتر اذیتت می‌کند؟',
        options: [
          { value: 'body_double', label: '🌀 بی‌برنامگی و «یه روز همو ببینیم» که هیچ‌وقت اجرا نمی‌شود' },
          { value: 'gentle_pace', label: '🔊 شلوغی زیاد، عجله و توقع انرژی بالا' },
          { value: 'structured', label: '⏰ تغییر لحظه‌آخری زمان و مکان' },
        ],
      },
      {
        q: 'کدام نوع قرار مشترک برایت جذاب‌تر است؟',
        options: [
          { value: 'body_double', label: '💻 کافه برای کار/درس کنار هم، یا پیاده‌روی منظم با همراه' },
          { value: 'gentle_pace', label: '🚶‍♀️ قدم‌زدن آرام در پارک بدون عجله' },
          { value: 'structured', label: '🏸 کلاس، ورزش یا قرار منظم در ساعت دقیق' },
        ],
      },
    ],
    traits: {
      body_double: {
        title: 'همراهِ بادی‌دبلینگ',
        short: 'شروع آسان‌تر کنار هم‌پا',
        desc: 'حضورِ یک همراه امن و بدون قضاوت به تو کمک می‌کند کارها، ورزش یا درس را راحت‌تر شروع کنی.',
        tip: 'سیستم قرارهای بادی‌دبلینگ، پیاده‌روی ثابت و هم‌پاهای هم‌ریتم را برایت اولویت می‌دهد.',
      },
      gentle_pace: {
        title: 'ریتمِ آرام و کم‌تنش',
        short: 'فضای آرام بدون عجله',
        desc: 'محیط‌های آرام و همراهان صبور به تو کمک می‌کنند بدون خستگی ذهنی لذت ببری.',
        tip: 'سیستم قرارهای آرام و کم‌سروصدا را برایت بالاتر نمایش می‌دهد.',
      },
      structured: {
        title: 'منظم و برنامه‌محور',
        short: 'زمان‌بندی شفاف و دقیق',
        desc: 'شفافیت زمان و مکان به تو آرامش می‌دهد و راحت‌تر به قرارهای تکراری پایبند می‌مانی.',
        tip: 'سیستم قرارهایی با روز و ساعت مشخص را در اولویت قرار می‌دهد.',
      },
    },
  },
  {
    key: 'social_lang',
    icon: '💬',
    title: 'تست زبانِ دوستی و معاشرت',
    subtitle: 'در کنار دوستانت چطور بیشتر احساس نزدیکی می‌کنی؟ — ۳ سؤال',
    sourceNote: 'الهام‌گرفته از الگوهای پیوند اجتماعی',
    questions: [
      {
        q: 'کدام لحظه با یک دوست بیشترین حال خوب را به تو می‌دهد؟',
        options: [
          { value: 'deep_talk', label: '☕ گفتگوی عمیق و واقعی دربارهٔ زندگی و تجربه‌ها' },
          { value: 'shared_activity', label: '🏃‍♀️ انجام یک کار مشترک (پیاده‌روی، ورزش، بازی، آشپزی)' },
          { value: 'co_presence', label: '📖 کنار هم بودن در سکوتِ راحت (کتاب، کار، پارک)' },
        ],
      },
      {
        q: 'برای شکستن یخ در دیدار اول کدام راحت‌تر است؟',
        options: [
          { value: 'deep_talk', label: '💬 یک چای یا قهوه و صحبت صمیمی' },
          { value: 'shared_activity', label: '🌳 راه رفتن کنار هم یا یک بازی/فعالیت تا نیاز به مکالمهٔ اجباری نباشد' },
          { value: 'co_presence', label: '🎨 کار کردن یا نقاشی/مطالعه در یک کافهٔ آرام کنار هم' },
        ],
      },
      {
        q: 'دوست داری بعد از ۶ ماه چه خاطره‌ای با دوستت ساخته باشی؟',
        options: [
          { value: 'deep_talk', label: '💛 کسی که می‌شود ساعت ۳ صبح با خیال راحت بهش زنگ زد' },
          { value: 'shared_activity', label: '🌟 کلی پیاده‌روی، سفر کوتاه و کارهای باحال مشترک' },
          { value: 'co_presence', label: '🕊️ کسی که حتی در سکوت هم کنارش کاملاً راحتی' },
        ],
      },
    ],
    traits: {
      deep_talk: {
        title: 'اهلِ گفتگوی عمیق',
        short: 'گپ واقعی و کافه آرام',
        desc: 'گفتگوهای صادقانه و بدون تعارف برای تو سریع‌ترین راه ساختن دوستی واقعی است.',
        tip: 'سیستم کافه‌های آرام و قرارهای ۱-به-۱ را برایت بالاتر می‌آورد.',
      },
      shared_activity: {
        title: 'اهلِ تجربه و فعالیت مشترک',
        short: 'پیاده‌روی، ورزش و بازی',
        desc: 'در حین حرکت، پیاده‌روی یا یک فعالیت مشترک خیلی راحت‌تر یخت باز می‌شود و پیوند می‌سازی.',
        tip: 'سیستم قرارهای پیاده‌روی، ورزش و بازی را در اولویتت قرار می‌دهد.',
      },
      co_presence: {
        title: 'اهلِ هم‌نشینی آرام',
        short: 'کنار هم بودن بدون فشار',
        desc: 'بودن در کنار آدم‌های امن بدون نیاز به حرف زدنِ مداوم برایت آرامش‌بخش‌ترین نوع دوستی است.',
        tip: 'سیستم قرارهای بادی‌دبلینگ و فضای آرام را برایت بالاتر می‌آورد.',
      },
    },
  },
];

export function scoreQuizResult(answers: string[]): string {
  const counts: Record<string, number> = {};
  for (const a of answers) {
    if (!a) continue;
    counts[a] = (counts[a] || 0) + 1;
  }
  let best = answers[0] || '';
  let max = -1;
  for (const [k, c] of Object.entries(counts)) {
    if (c > max) {
      max = c;
      best = k;
    }
  }
  return best;
}

/**
 * Computes a private, zero-disclosure compatibility score between a meetup and the viewer's local profile.
 * Never reveals *why* or exposes any hidden info — only returns a score + gentle generic badge.
 */
export function computeEventMatch(
  meetup: Record<string, any>,
  profileData: Record<string, any> | null | undefined
): { score: number; badge: string } {
  if (!profileData || typeof profileData !== 'object') return { score: 0, badge: '' };
  let score = 0;

  const aud = meetup.audience || meetup.final?.audience || {};
  const loc = meetup.location || meetup.final?.location || {};
  const rhy = meetup.rhythm || meetup.final?.rhythm || {};
  const tags: string[] = Array.isArray(aud.tags) ? aud.tags : [];
  const title = String(meetup.title || '') + ' ' + String(meetup.note || '');
  const isPair = /هم‌پا|دو[\s\u200c]?نفره|۱\s*به\s*۱|1\s*on\s*1|پارتنر|بادی/i.test(title);

  // 1. Hard boundary safety checks (penalize incompatible boundaries symmetrically)
  if (profileData.smoke === 'bothers' && aud.smoke === 'ok') score -= 40;
  if (profileData.smoke === 'smoke' && aud.smoke === 'no_smoke') score -= 35;
  if (profileData.smoke === 'bothers' && aud.smoke === 'no_smoke') score += 20;
  if (profileData.alcohol === 'none_place' && aud.alcohol === 'ok') score -= 40;
  if (profileData.alcohol === 'drink' && aud.alcohol === 'no_alcohol') score -= 35;
  if (profileData.alcohol === 'none_place' && aud.alcohol === 'no_alcohol') score += 20;

  // 2. City proximity
  const myCities = new Set<string>([
    ...(Array.isArray(profileData.can_cities) ? profileData.can_cities : []),
    ...(profileData.origin?.key ? [profileData.origin.key] : []),
  ]);
  if (loc.city && myCities.has(loc.city)) score += 30;

  // 3. Hidden self-discovery (psych) alignment — zero disclosure
  const psych = (profileData.psych && typeof profileData.psych === 'object' ? profileData.psych : {}) as Record<string, string>;
  if (psych.social_energy === 'introvert') {
    if (isPair || tags.includes('quiet')) score += 18;
  } else if (psych.social_energy === 'extrovert') {
    if (!isPair) score += 10;
  }

  if (psych.friendship_style === 'steady_safe' && rhy.freq && rhy.freq !== 'once') {
    score += 18;
  }

  if (psych.focus_rhythm === 'body_double') {
    if (tags.includes('adhd_friendly') || /بادی|کار|درس|پیاده‌روی|ورزش/.test(title)) score += 20;
  } else if (psych.focus_rhythm === 'gentle_pace') {
    if (tags.includes('quiet') || /آرام|پیاده‌روی|کافه/.test(title)) score += 15;
  }

  if (psych.social_lang === 'deep_talk' && (isPair || /کافه|گپ|چای|قهوه/.test(title))) score += 14;
  if (psych.social_lang === 'shared_activity' && /پیاده‌روی|ورزش|دویدن|بدمینتون|بازی|دوچرخه/.test(title)) score += 14;
  if (psych.social_lang === 'co_presence' && (tags.includes('adhd_friendly') || tags.includes('quiet'))) score += 14;

  // 4. Hidden challenges alignment (gentle boost without ever saying why)
  const chals: string[] = Array.isArray(profileData.private_challenges) ? profileData.private_challenges : [];
  if (chals.includes('adhd') && (tags.includes('adhd_friendly') || /بادی|کار/.test(title))) score += 16;
  if (chals.includes('weight_journey') && /پیاده‌روی|ورزش|دویدن|بدمینتون/.test(title)) score += 16;
  if (chals.includes('social_anxiety') && (isPair || tags.includes('quiet'))) score += 16;

  // 5. Vegan / diet alignment
  const diet: string[] = Array.isArray(profileData.diet) ? profileData.diet : [];
  if ((diet.includes('vegan') || diet.includes('veg')) && tags.includes('veg')) score += 18;

  let badge = '';
  if (score >= 42) badge = '✨ خیلی به حال‌وهوات می‌خوره';
  else if (score >= 22) badge = '🌿 هم‌فازِ تو';

  return { score, badge };
}
