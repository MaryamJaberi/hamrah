import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const newCode = () => String(randomInt(100000, 1000000));
export const hashCode = (phone: string, code: string) =>
  createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'dev').update(`${phone}:${code}`).digest('hex');
export const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Supabase Auth needs an email for magic-link sessions; phone users get a non-deliverable placeholder. */
export const phoneEmail = (phone: string) => `p${phone.replace(/\D/g, '')}@phone.hamrah.invalid`;
