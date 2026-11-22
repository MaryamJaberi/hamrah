import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { admin } from '@/lib/supabase/admin';
import { getSession } from '@/lib/supabase/server';

const DIRECTORY_CODE = '__profiles__';
const IGNORE_NAMES = new Set(['مهمان', 'تست']);
const DH_FALLBACK_URL = 'https://healdibivptzehahdvig.supabase.co';
const DH_FALLBACK_ANON = 'sb_publishable_PCopQgyzrd2CYNlQihNxDw_7v_PrV65';

async function fetchFallbackRpcProfiles() {
  const sb = createClient(DH_FALLBACK_URL, DH_FALLBACK_ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: dir }, { data: m1 }] = await Promise.all([
    sb.rpc('dh_get', { p_code: DIRECTORY_CODE, p_admin: null }),
    sb.rpc('dh_get', { p_code: '096be90f6c', p_admin: null }),
  ]);
  const byName = new Map<string, any>();
  const ingest = (m: any, isReal: boolean) => {
    if (!m || !Array.isArray(m.people)) return;
    for (const p of m.people) {
      const cleanName = String(p.name ?? '').trim();
      if (!cleanName || IGNORE_NAMES.has(cleanName) || /^تست\b/i.test(cleanName)) continue;
      const key = cleanName.toLowerCase();
      const { id, name, member, ...restData } = p;
      const prev = byName.get(key);
      if (!prev) {
        byName.set(key, {
          name: cleanName,
          data: { ...restData },
          public_fields: Object.keys(restData),
          updated_at: m.created_at,
          meetups: isReal ? [{ code: m.code, title: m.title, final: m.final }] : [],
        });
      } else {
        prev.data = { ...restData, ...prev.data };
        if (isReal && !prev.meetups.some((x: any) => x.code === m.code)) {
          prev.meetups.push({ code: m.code, title: m.title, final: m.final });
        }
      }
    }
  };
  ingest(dir, false);
  ingest(m1, true);
  const recentMeetups = m1 ? [{ code: m1.code, title: m1.title, organizer_name: m1.organizer_name, final: m1.final }] : [];
  return { profiles: [...byName.values()], recentMeetups };
}

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
  const url = new URL(req.url);
  const onlyName = url.searchParams.get('name')?.trim();
  const db = admin();

  const [{ data: rows }, { data: meetups }] = await Promise.all([
    db
      .from('dh_responses')
      .select('id,meetup_id,name,data,public_fields,updated_at')
      .order('updated_at', { ascending: false })
      .limit(200),
    db
      .from('dh_meetups')
      .select('id,code,title,note,organizer_name,final,created_at')
      .neq('code', DIRECTORY_CODE)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  const meetupById = new Map((meetups ?? []).map((m: any) => [m.id, m]));
  const byName = new Map<
    string,
    {
      name: string;
      data: Record<string, any>;
      public_fields: string[];
      updated_at: string;
      meetups: { code: string; title: string; final: any }[];
    }
  >();

  for (const r of rows ?? []) {
    const cleanName = String(r.name ?? '').trim();
    if (!cleanName || IGNORE_NAMES.has(cleanName) || /^تست\b/i.test(cleanName)) continue;
    const key = cleanName.toLowerCase();
    const prev = byName.get(key);
    const rData = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, any>;
    const m = meetupById.get(r.meetup_id);
    const isRealMeetup = m && !/e2e|تست دورهمی/i.test(m.title ?? '');

    if (!prev) {
      byName.set(key, {
        name: cleanName,
        data: { ...rData },
        public_fields: Array.isArray(r.public_fields) ? r.public_fields : [],
        updated_at: r.updated_at,
        meetups: isRealMeetup ? [{ code: m.code, title: m.title, final: m.final }] : [],
      });
    } else {
      prev.data = { ...rData, ...prev.data };
      if (!prev.public_fields.length && Array.isArray(r.public_fields)) {
        prev.public_fields = r.public_fields;
      }
      if (isRealMeetup && !prev.meetups.some((x) => x.code === m.code)) {
        prev.meetups.push({ code: m.code, title: m.title, final: m.final });
      }
    }
  }

  const recentMeetups = (meetups ?? [])
    .filter((m: any) => !/e2e|تست دورهمی/i.test(m.title ?? ''))
    .slice(0, 10)
    .map((m: any) => ({ code: m.code, title: m.title, organizer_name: m.organizer_name, final: m.final }));

  let profiles = [...byName.values()];
  let finalMeetups = recentMeetups;

  if (!profiles.length && !finalMeetups.length) {
    const fb = await fetchFallbackRpcProfiles().catch(() => null);
    if (fb) {
      profiles = fb.profiles;
      finalMeetups = fb.recentMeetups;
    }
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
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const publicFields = Array.isArray(body.public_fields)
    ? body.public_fields.filter((x: unknown): x is string => typeof x === 'string').slice(0, 40)
    : [];

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 400 });

  const db = admin();
  const dirId = await getOrCreateDirectoryMeetupId(db).catch(() => null);
  if (!dirId) {
    // Fallback to public RPC on Dorehami DB when service role is configured for a different project
    const sb = createClient(DH_FALLBACK_URL, DH_FALLBACK_ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const cleanData = { ...data };
    delete cleanData.avail;
    const { data: res, error } = await sb.rpc('dh_respond', {
      p_code: DIRECTORY_CODE,
      p_edit: body.edit_token ?? null,
      p_name: name,
      p_data: cleanData,
      p_public: publicFields.length
        ? publicFields
        : ['origin', 'can_cities', 'free_windows', 'free_note', 'modes', 'activities', 'hobbies', 'about'],
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, name, edit_token: res?.edit_token ?? null });
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
