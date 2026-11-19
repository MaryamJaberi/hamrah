'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['/discover', '🔍', 'کشف'], ['/out', '🌆', 'بیرون'], ['/goals', '🎯', 'هدف‌ها'], ['/sessions', '📅', 'جلسه‌ها'],
  ['/chat', '💬', 'چت'], ['/profile', '👤', 'من'],
] as const;

export default function Nav({ pending = 0 }: { pending?: number }) {
  const path = usePathname();
  return (
    <nav aria-label="ناوبری اصلی" className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-[480px] flex bg-white/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
      {items.map(([href, ico, lbl]) => {
        const on = path.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={on ? 'page' : undefined}
            className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${on ? 'text-primary' : 'text-muted'}`}>
            <span aria-hidden className={`text-xl ${on ? '' : 'grayscale opacity-60'}`}>{ico}</span>
            {lbl}
            {href === '/discover' && pending > 0 && (
              <span className="absolute top-1 right-[calc(50%-22px)] bg-warn text-white text-[9px] font-extrabold px-1.5 rounded-full">{pending}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
