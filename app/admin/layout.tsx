import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  if (!user) redirect('/login');
  if (!profile?.is_admin) redirect('/discover');
  const links = [['/admin', '📊 داشبورد'], ['/admin/kyc', '🪪 هویت'], ['/admin/reports', '🚨 گزارش‌ها'], ['/admin/users', '👥 کاربران'], ['/admin/payments', '💳 پرداخت‌ها'], ['/discover', '← اپ']];
  return (
    // admin is desktop-width, escaping the 480px app column
    <div className="fixed inset-0 overflow-y-auto bg-[#F4F4FA]">
      <nav className="bg-white border-b border-line sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 flex gap-1 overflow-x-auto">
          {links.map(([h, l]) => <Link key={h} href={h} className="px-3 py-3 text-sm font-bold whitespace-nowrap hover:text-primary">{l}</Link>)}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
