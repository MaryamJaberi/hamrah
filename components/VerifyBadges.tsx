import type { Profile } from '@/lib/types';
export default function VerifyBadges({ p }: { p: Pick<Profile, 'verified_email' | 'verified_phone' | 'verified_id'> }) {
  const items = [['verified_email', 'ایمیل'], ['verified_phone', 'موبایل'], ['verified_id', 'هویت']] as const;
  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {items.map(([k, l]) => (
        <span key={k} className={`chip text-[10px] ${p[k] ? 'chip-accent' : 'chip-ghost'}`}>{p[k] ? '✓' : '—'} {l}</span>
      ))}
    </div>
  );
}
