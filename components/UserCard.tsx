import type { Profile } from '@/lib/types';
export default function UserHead({ u, right }: { u: Profile; right?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="text-3xl w-12 h-12 rounded-2xl bg-primary-soft grid place-items-center shrink-0" aria-hidden>{u.avatar}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold truncate">{u.name}</span>
          {u.verified_id && <span className="chip chip-accent text-[10px]" title="هویت تأییدشده">✓</span>}
          {u.is_mentor && <span className="chip text-[10px]">منتور</span>}
          {right && <span className="ms-auto">{right}</span>}
        </div>
        <div className="text-xs text-muted">{u.rating_count ? `⭐ ${Number(u.rating_avg).toFixed(1)} (${u.rating_count})` : 'بدون نظر'} · {u.city}</div>
      </div>
    </div>
  );
}
