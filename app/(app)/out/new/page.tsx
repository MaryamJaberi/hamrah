import { getSession } from '@/lib/supabase/server';
import NewPlan from './NewPlan';

export default async function NewPlanPage() {
  const { supabase, user } = await getSession();
  const { data: op } = await supabase.from('outing_profiles').select('gender,area_label,area_lat,area_lng').eq('user_id', user!.id).maybeSingle();
  return (
    <main className="page">
      <h1 className="h1">برنامه با دوستام 👯‍♀️</h1>
      <NewPlan isWoman={op?.gender === 'woman'} area={{ label: op?.area_label ?? '', lat: op?.area_lat ?? null, lng: op?.area_lng ?? null }} />
    </main>
  );
}
