export type Mode = 'online' | 'inperson' | 'both';
export type Currency = 'usd' | 'eur' | 'irr';

export type Profile = {
  id: string; name: string; avatar: string; city: string; bio: string | null;
  interests: string[]; teach_langs: string[]; learn_langs: string[]; mode: Mode;
  is_mentor: boolean; mentor_price: number; mentor_currency: Currency;
  mentor_bio: string | null; mentor_topics: string[];
  verified_email: boolean; verified_phone: boolean; verified_id: boolean;
  kyc_status: 'none' | 'pending' | 'approved' | 'rejected';
  rating_avg: number; rating_count: number; is_admin: boolean; is_banned: boolean;
  created_at: string;
};

export type Goal = {
  id: string; user_id: string; title: string; category: string; mode: Mode;
  per_week: number; level: 'light' | 'medium' | 'serious'; progress: number; created_at: string;
};

export type Connection = {
  id: string; user_a: string; user_b: string; kind: 'buddy' | 'mentorship'; status: string; created_at: string;
};

export type Message = { id: string; connection_id: string; sender: string; body: string; created_at: string };
