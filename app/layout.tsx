import './globals.css';
import type { Metadata, Viewport } from 'next';
import NativeInit from '@/components/NativeInit';

export const metadata: Metadata = {
  title: 'همراه',
  description: 'همراه برای انجام کارها، یادگیری، ایونت و منتورشیپ',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#6C5CE7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans">
        <NativeInit />
        <div className="mx-auto max-w-[480px] min-h-screen">{children}</div>
      </body>
    </html>
  );
}
