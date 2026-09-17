import { redirect } from 'next/navigation';
import Nav from '@/components/Nav';
import { createClient } from '@/lib/supabase/server';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { count } = await supabase.from('requests').select('id', { count: 'exact', head: true }).eq('to_user', user.id).eq('status', 'pending');
  return (<>{children}<Nav pending={count ?? 0} /></>);
}
