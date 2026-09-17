import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="p-6 text-center mt-24">
      <div className="text-5xl mb-3">🧭</div>
      <h1 className="font-extrabold mb-2">این صفحه پیدا نشد</h1>
      <Link href="/discover" className="btn mt-4">بازگشت</Link>
    </div>
  );
}
