import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { getSession } from '@/lib/supabase/server';

const DIRECTORY_CODE = '__profiles__';
const IGNORE_NAMES = new Set(['مهمان', 'تست']);

async function getOrCreateDirectoryMeetupId(db: ReturnType<typeof admin>): Promise<string | null> {
  const { data: existing } = await db
    .from('dh_meetups')
    .select('id')
    .eq('code', DIRECTORY_CODE)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await db
    .from('dh_meetups')
    .insert({
      code: DIRECTORY_CODE,
      title: 'پروفایل‌های دورهمی',
      organizer_name: 'همراه',
      options: [],
      women_only: false,
    })
    .select('id')
    .single();
  return created?.id ?? null;
}

/**
 * GET /api/d/profiles
 * Returns known member profiles (e.g. مریم, انیتا, Nika, آیدا and anyone who saved a profile or answered a meetup)
 * plus their recent non-test meetups so returning friends can pick their name and see/reuse their info & free hours.
 */
export async function GET(req: Request) {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!sbUrl || sbUrl.includes('example.supabase.co')) {
    return NextResponse.json({ profiles: [], recentMeetups: [] });
  }
  const url = new URL(req.url);
  const onlyName = url.searchParams.get('name')?.trim();
  const onlyEmail = url.searchParams.get('email')?.trim().toLowerCase();
  const db = admin();

  const [{ data: rows }, meetupRes] = await Promise.all([
    db
      .from('dh_responses')
      .select('id,meetup_id,name,data,public_fields,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200),
    db
      .from('dh_meetups')
      .select('id,code,title,note,organizer_name,final,expires_at,is_archived,created_at')
      .neq('code', DIRECTORY_CODE)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  let meetups = meetupRes.data;
  if (meetupRes.error) {
    const fbRes = await db
      .from('dh_meetups')
      .select('id,code,title,note,organizer_name,final,created_at')
      .neq('code', DIRECTORY_CODE)
      .order('created_at', { ascending: false })
      .limit(30);
    meetups = fbRes.data as any;
  }

  const meetupById = new Map((meetups ?? []).map((m: any) => [m.id, m]));
  const countByMeetupId = new Map<string, number>();
  for (const r of rows ?? []) {
    countByMeetupId.set(r.meetup_id, (countByMeetupId.get(r.meetup_id) ?? 0) + 1);
  }

  const byName = new Map<
    string,
    {
      name: string;
      email?: string | null;
      data: Record<string, any>;
      public_fields: string[];
      updated_at: string;
      meetups: { code: string; title: string; organizer_name?: string; count?: number; final: any }[];
    }
  >();

  for (const r of rows ?? []) {
    const cleanName = String(r.name ?? '').trim();
    if (!cleanName || IGNORE_NAMES.has(cleanName) || /^تست\b/i.test(cleanName)) continue;
    const key = cleanName.toLowerCase();
    const rDataRaw = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, any>;
    const pubList: string[] = Array.isArray(r.public_fields) ? r.public_fields : [];
    const pubSet = new Set(pubList.filter((f) => f !== 'private_challenges' && f !== 'psych' && f !== 'email' && f !== 'contact'));
    // Strictly project only public_fields for public directory responses (never leak private_challenges, psych, email, contact, or hidden fields)
    const rData: Record<string, any> = {};
    for (const [fk, fv] of Object.entries(rDataRaw)) {
      if (pubSet.has(fk) || fk === 'can_cities' || fk === 'free_windows') {
        if (fk !== 'private_challenges' && fk !== 'psych' && fk !== 'email' && fk !== 'contact') {
          rData[fk] = fv;
        }
      }
    }
    const emailKey = typeof rDataRaw.email === 'string' && rDataRaw.email.includes('@') ? rDataRaw.email.trim().toLowerCase() : null;
    const prev = byName.get(key) || (emailKey ? byName.get(emailKey) : undefined);
    const m = meetupById.get(r.meetup_id);
    // Skip responses from private, archived, or test meetups (keep __profiles__ directory entries)
    if (m && m.code !== DIRECTORY_CODE) {
      if (m.final?.audience?.visibility === 'private' || Boolean(m.is_archived || m.final?.archived) || /e2e|تست دورهمی/i.test(m.title ?? '')) {
        continue;
      }
    }
    const isRealMeetup =
      m &&
      m.code !== DIRECTORY_CODE &&
      !/e2e|تست دورهمی/i.test(m.title ?? '') &&
      !Boolean(m.is_archived || m.final?.archived) &&
      m.final?.audience?.visibility !== 'private';

    if (!prev) {
      const entry = {
        name: cleanName,
        email: null as string | null,
        data: { ...rData },
        public_fields: Array.from(pubSet),
        updated_at: r.updated_at,
        meetups: isRealMeetup
          ? [{ code: m.code, title: m.title, organizer_name: m.organizer_name, count: countByMeetupId.get(m.id) ?? 1, final: m.final }]
          : [],
      };
      byName.set(key, entry);
      if (emailKey) byName.set(emailKey, entry);
    } else {
      prev.data = { ...rData, ...prev.data };
      if (emailKey && !prev.email) {
        prev.email = emailKey;
        byName.set(emailKey, prev);
      }
      if (!prev.public_fields.length && Array.isArray(r.public_fields)) {
        prev.public_fields = r.public_fields;
      }
      if (isRealMeetup && !prev.meetups.some((x) => x.code === m.code)) {
        prev.meetups.push({
          code: m.code,
          title: m.title,
          organizer_name: m.organizer_name,
          count: countByMeetupId.get(m.id) ?? 1,
          final: m.final,
        });
      }
    }
  }

  const recentMeetups = (meetups ?? [])
    .filter((m: any) => {
      if (/e2e|تست دورهمی/i.test(m.title ?? '')) return false;
      const isArchived = Boolean(m.is_archived || m.final?.archived);
      if (isArchived) return false;
      if (m.final?.audience?.visibility === 'private') return false;
      const exp = m.expires_at || m.final?.expires_at;
      if (exp) {
        const expMs = /^\d{4}-\d{2}-\d{2}$/.test(String(exp))
          ? new Date(`${exp}T23:59:59.000Z`).getTime()
          : new Date(exp).getTime();
        if (!Number.isNaN(expMs) && expMs < Date.now()) return false;
      }
      return true;
    })
    .slice(0, 10)
    .map((m: any) => ({
      code: m.code,
      title: m.title,
      organizer_name: m.organizer_name,
      count: countByMeetupId.get(m.id) ?? 0,
      final: m.final,
      location: m.final?.location || null,
      audience: m.final?.audience || null,
      rhythm: m.final?.rhythm || null,
      expires_at: m.expires_at || m.final?.expires_at || null,
      is_archived: Boolean(m.is_archived || m.final?.archived),
      created_at: m.created_at,
    }));

  const profiles = Array.from(new Set(byName.values()));
  const finalMeetups = recentMeetups;

  if (onlyEmail) {
    const found = profiles.find((p) => (p.email || p.data?.email || '').toLowerCase() === onlyEmail) ?? null;
    return NextResponse.json({ profile: found, recentMeetups: finalMeetups });
  }

  if (onlyName) {
    const found = profiles.find((p) => p.name.toLowerCase() === onlyName.toLowerCase()) ?? null;
    return NextResponse.json({ profile: found, recentMeetups: finalMeetups });
  }

  return NextResponse.json({ profiles, recentMeetups: finalMeetups });
}

/**
 * POST /api/d/profiles
 * Saves/updates a person's reusable Dorehami profile (including their weekly free hours & preferred locations).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 40);
  const email = typeof body.email === 'string' && body.email.includes('@') ? body.email.trim().toLowerCase().slice(0, 120) : null;
  const data = body.data && typeof body.data === 'object' ? { ...body.data } : {};
  if (email) data.email = email;
  const publicFields = Array.isArray(body.public_fields)
    ? body.public_fields
        .filter((x: unknown): x is string => typeof x === 'string' && x !== 'private_challenges' && x !== 'psych' && x !== 'email')
        .slice(0, 40)
    : [];

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const db = admin();
  const dirId = await getOrCreateDirectoryMeetupId(db).catch(() => null);
  if (!dirId) {
    return NextResponse.json({ error: 'profile_directory_unavailable' }, { status: 503 });
  }

  const { user } = await getSession().catch(() => ({ user: null }));

  const { data: existing } = await db
    .from('dh_responses')
    .select('id,data')
    .eq('meetup_id', dirId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  const mergedData = { ...(existing?.data ?? {}), ...data };
  delete mergedData.avail;

  if (existing?.id) {
    await db
      .from('dh_responses')
      .update({
        name,
        data: mergedData,
        public_fields: publicFields,
        user_id: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
  } else {
    await db.from('dh_responses').insert({
      meetup_id: dirId,
      name,
      data: mergedData,
      public_fields: publicFields,
      user_id: user?.id ?? null,
    });
  }

  return NextResponse.json({ ok: true, name });
}
