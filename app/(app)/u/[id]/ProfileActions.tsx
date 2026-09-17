'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import RequestForm from '@/components/RequestForm';
import type { Profile } from '@/lib/types';

export default function ProfileActions({ to, connId, pending, goals }: { to: Profile; connId: string | null; pending: boolean; goals: { id: string; title: string }[] }) {
  const router = useRouter();
  if (connId) return <Link href={`/chat/${connId}`} className="btn w-full">💬 گفتگو</Link>;
  if (pending) return <button className="btn btn-sec w-full" disabled>⏳ درخواست در انتظار پاسخ</button>;
  return <RequestForm to={to} goals={goals} onSent={() => router.refresh()} />;
}
