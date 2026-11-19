import Link from 'next/link';
import { LIFESTYLE, USE_OPTS, activityIcon, faNum, type OutCard as Card } from '@/lib/outings';

/** A person as the viewer is allowed to see them (fields the RPC withheld simply don't render). */
export default function OutCard({ c, children, compact, self }: { c: Card; children?: React.ReactNode; compact?: boolean; self?: boolean }) {
  const ls = c.lifestyle ?? {};
  const shown = LIFESTYLE.filter(([k]) => ls[k]);
  return (
    <div className="card mb-3">
      <div className="flex items-start gap-3">
        <Link href={`/u/${c.id}`} className="text-3xl leading-none" aria-label={`پروفایل ${c.name}`}>{c.avatar}</Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <b className="text-sm">{c.name}{self ? ' (تو)' : ''}</b>
            {c.age != null && <span className="text-xs text-muted">{faNum(c.age)} ساله</span>}
            {c.verified_id && <span className="chip-accent chip !py-0 !text-[10px]">احراز شده</span>}
            {c.role === 'organizer' && <span className="chip !py-0 !text-[10px]">برگزارکننده</span>}
            {c.status === 'invited' && <span className="chip-ghost chip !py-0 !text-[10px]">دعوت شده</span>}
            {typeof c.score === 'number' && !compact && <span className="chip !py-0 !text-[10px] ms-auto">هم‌خوانی {faNum(c.score)}٪</span>}
          </div>
          <p className="text-xs text-muted mt-0.5">
            {[c.job, c.area_label || c.city].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {!compact && (
        <>
          {!!c.reasons?.length && (
            <ul className="mt-2 flex flex-wrap gap-1" aria-label="چرا پیشنهاد شد">
              {c.reasons.map((r) => <li key={r} className="chip chip-accent !text-[11px]">{r}</li>)}
            </ul>
          )}
          {!!c.activities?.length && (
            <p className="text-xs mt-2"><span className="text-muted">دوست داره: </span>{c.activities.slice(0, 6).map((a) => `${activityIcon(a)} ${a}`).join('  ')}</p>
          )}
          {!!c.hobbies?.length && <p className="text-xs mt-1"><span className="text-muted">علاقه‌ها: </span>{c.hobbies.slice(0, 8).join('، ')}</p>}
          {!!c.places_liked?.length && <p className="text-xs mt-1"><span className="text-muted">جاهای محبوب: </span>{c.places_liked.slice(0, 5).join('، ')}</p>}
          {shown.length > 0 && (
            <p className="text-xs mt-2 bg-[#F7F6FF] rounded-xl px-3 py-2">
              <span className="text-muted">{self ? '🔒 جواب‌های خودت (بقیه فقط بخش‌های «دوطرفه» را می‌بینند): ' : '🔒 دوطرفه به اشتراک گذاشته: '}</span>
              {shown.map(([k, l, ico]) => `${ico} ${l}: ${USE_OPTS.find(([v]) => v === ls[k])?.[1]}`).join('  ·  ')}
            </p>
          )}
        </>
      )}
      {children && <div className="mt-3 flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
