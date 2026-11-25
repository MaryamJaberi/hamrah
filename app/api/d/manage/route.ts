import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabase/admin';
import { getSession } from '@/lib/supabase/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, admin_token, action } = body;
    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'کد نامعتبر است' }, { status: 400 });
    }

    const cleanCode = code.toLowerCase().trim();
    const db = admin();
    const session = await getSession();
    const userId = session?.user?.id;

    const { data: m, error: mErr } = await db
      .from('dh_meetups')
      .select('*')
      .eq('code', cleanCode)
      .maybeSingle();

    if (mErr || !m) {
      return NextResponse.json({ error: 'دورهمی پیدا نشد' }, { status: 404 });
    }

    const isAdmin =
      (admin_token && admin_token === m.admin_token) ||
      (userId && userId === m.organizer_id);

    if (!isAdmin) {
      return NextResponse.json({ error: 'دسترسی مدیریت ندارید' }, { status: 403 });
    }

    // 1. DELETE
    if (action === 'delete') {
      const { error: delErr } = await db.from('dh_meetups').delete().eq('id', m.id);
      if (delErr) throw delErr;
      return NextResponse.json({ ok: true, deleted: true });
    }

    // 2. ARCHIVE / UNARCHIVE
    if (action === 'archive') {
      const currentFinal = (m.final && typeof m.final === 'object' ? m.final : {}) as Record<string, any>;
      const currentlyArchived = Boolean(m.is_archived || currentFinal.archived);
      const targetArchived = body.is_archived !== undefined ? Boolean(body.is_archived) : !currentlyArchived;

      const newFinal = { ...currentFinal, archived: targetArchived };
      const updates: Record<string, any> = { final: newFinal };

      const { error: upErr } = await db
        .from('dh_meetups')
        .update({ ...updates, is_archived: targetArchived })
        .eq('id', m.id);
      if (upErr) {
        const { error: fbErr } = await db.from('dh_meetups').update(updates).eq('id', m.id);
        if (fbErr) throw fbErr;
      }

      return NextResponse.json({ ok: true, is_archived: targetArchived });
    }

    // 3. EDIT
    if (action === 'edit') {
      const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : m.title;
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : m.note;
      const women_only = typeof body.women_only === 'boolean' ? body.women_only : m.women_only;
      const options = Array.isArray(body.options) ? body.options.slice(0, 10) : m.options;

      const currentFinal = (m.final && typeof m.final === 'object' ? m.final : {}) as Record<string, any>;

      let expires_at: string | null = currentFinal.expires_at ?? m.expires_at ?? null;
      if (body.expires_at !== undefined) {
        if (typeof body.expires_at === 'string' && body.expires_at.trim()) {
          const raw = body.expires_at.trim();
          const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59.000Z`) : new Date(raw);
          if (Number.isNaN(parsed.getTime())) {
            return NextResponse.json({ error: 'فرمت تاریخ انقضا معتبر نیست' }, { status: 400 });
          }
          expires_at = parsed.toISOString();
        } else {
          expires_at = null;
        }
      }

      let location: Record<string, any> | null = currentFinal.location ?? null;
      if (body.location !== undefined) {
        if (body.location && typeof body.location === 'object' && body.location.mode && body.location.mode !== 'flexible') {
          const mode = body.location.mode === 'exact' ? 'exact' : 'area';
          location = {
            mode,
            city: typeof body.location.city === 'string' ? body.location.city.trim().slice(0, 60) : '',
            city_label: typeof body.location.city_label === 'string' ? body.location.city_label.trim().slice(0, 80) : '',
            radius_km: typeof body.location.radius_km === 'number' && Number.isFinite(body.location.radius_km)
              ? Math.max(1, Math.min(100, Math.round(body.location.radius_km)))
              : undefined,
            place: typeof body.location.place === 'string' ? body.location.place.trim().slice(0, 140) : '',
          };
        } else {
          location = null;
        }
      }

      let audience: Record<string, any> | null = currentFinal.audience ?? null;
      if (body.audience !== undefined) {
        if (body.audience && typeof body.audience === 'object') {
          const vis = ['public', 'nearby', 'private'].includes(body.audience.visibility) ? body.audience.visibility : 'public';
          const smoke = ['any', 'no_smoke', 'ok'].includes(body.audience.smoke) ? body.audience.smoke : 'any';
          const alcohol = ['any', 'no_alcohol', 'ok'].includes(body.audience.alcohol) ? body.audience.alcohol : 'any';
          const allowedTags = new Set(['veg', 'nl_friendly', 'adhd_friendly', 'quiet', 'no_photo']);
          const tags = Array.isArray(body.audience.tags)
            ? Array.from(new Set(body.audience.tags.filter((t: unknown) => typeof t === 'string' && allowedTags.has(t))))
            : [];
          audience = (vis === 'public' && smoke === 'any' && alcohol === 'any' && !tags.length)
            ? null
            : { visibility: vis, smoke, alcohol, ...(tags.length ? { tags } : {}) };
        } else {
          audience = null;
        }
      }

      let rhythm: Record<string, any> | null = currentFinal.rhythm ?? null;
      if (body.rhythm !== undefined) {
        if (body.rhythm && typeof body.rhythm === 'object' && ['weekly', 'biweekly', 'once'].includes(body.rhythm.freq)) {
          const freq = body.rhythm.freq;
          if (freq === 'once') {
            rhythm = null;
          } else {
            const day = typeof body.rhythm.day === 'string' ? body.rhythm.day.trim().slice(0, 16) : 'any';
            const slot = typeof body.rhythm.slot === 'string' ? body.rhythm.slot.trim().slice(0, 16) : 'any';
            rhythm = { freq, day, slot };
          }
        } else {
          rhythm = null;
        }
      }

      const newFinal: Record<string, any> = { ...currentFinal, expires_at, location, audience, rhythm };
      if (!location) delete newFinal.location;
      if (!audience) delete newFinal.audience;
      if (!rhythm) delete newFinal.rhythm;
      const updates: Record<string, any> = {
        title,
        note,
        women_only,
        options,
        final: newFinal,
      };

      const { error: upErr } = await db
        .from('dh_meetups')
        .update({ ...updates, expires_at })
        .eq('id', m.id);
      if (upErr) {
        const { error: fbErr } = await db.from('dh_meetups').update(updates).eq('id', m.id);
        if (fbErr) throw fbErr;
      }

      return NextResponse.json({
        ok: true,
        title,
        note,
        women_only,
        options,
        expires_at,
        location,
        audience,
        rhythm,
        is_archived: Boolean(m.is_archived || currentFinal.archived),
      });
    }

    return NextResponse.json({ error: 'عملیات نامعتبر است' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in /api/d/manage:', err);
    return NextResponse.json({ error: err.message || 'خطای سرور' }, { status: 500 });
  }
}
