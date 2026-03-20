import type { Metadata } from 'next';
import './globals.css';
import dynamic from 'next/dynamic';

// ssr:false keeps @supabase/supabase-js out of the SSR server bundle.
// AuthProvider uses client-side auth (localStorage/cookies) so it doesn't
// need to be server-rendered; ProtectedRoute already handles auth redirects
// on the client side.
const Providers = dynamic(() => import('./Providers'), { ssr: false });

export const metadata: Metadata = {
  metadataBase: new URL('https://jobbuilda.co.uk'),
  title: 'JobBuilda | Admin Dashboard',
  description: 'Manage jobs, quotes, invoices and clients with JobBuilda — the smart platform for electrical contractors.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/jobbuilda_icon_32.png', sizes: '32x32', type: 'image/png' },
      { url: '/jobbuilda_icon_16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/jobbuilda_icon_180.png',
  },
  openGraph: {
    type: 'website',
    url: 'https://jobbuilda.co.uk',
    siteName: 'JobBuilda',
    title: 'JobBuilda | Admin Dashboard',
    description: 'Manage jobs, quotes, invoices and clients with JobBuilda — the smart platform for electrical contractors.',
    images: [
      {
        url: '/jobbuilda_logo_full.png',
        width: 1200,
        height: 400,
        alt: 'JobBuilda',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobBuilda | Admin Dashboard',
    description: 'Manage jobs, quotes, invoices and clients with JobBuilda — the smart platform for electrical contractors.',
    images: ['/jobbuilda_logo_full.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
