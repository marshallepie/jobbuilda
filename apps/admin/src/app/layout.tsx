import type { Metadata } from 'next';
import './globals.css';
import dynamic from 'next/dynamic';

// ssr:false keeps @supabase/supabase-js out of the SSR server bundle.
// AuthProvider uses client-side auth (localStorage/cookies) so it doesn't
// need to be server-rendered; ProtectedRoute already handles auth redirects
// on the client side.
const Providers = dynamic(() => import('./Providers'), { ssr: false });

export const metadata: Metadata = {
  title: 'JobBuilda Admin',
  description: 'Contractor management platform for electrical services',
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
