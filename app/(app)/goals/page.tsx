import { getSession } from '@/lib/supabase/server';
import GoalsClient from './GoalsClient';

export default async function Goals() {
  const { supabase, user } = await getSession();
  const { data: goals } = await supabase.from('goals').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
  return <main className="page"><h1 className="h1">هدف‌های من</h1><GoalsClient goals={goals ?? []} /></main>;
}
