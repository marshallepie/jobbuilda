import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://portal.jobbuilda.co.uk'),
  title: 'JobBuilda | Client Portal',
  description: 'View your job progress, approve quotes and pay invoices online with JobBuilda.',
  manifest: '/manifest.json',
  themeColor: '#1F2933',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'JobBuilda',
  },
  openGraph: {
    type: 'website',
    url: 'https://portal.jobbuilda.co.uk',
    siteName: 'JobBuilda',
    title: 'JobBuilda | Client Portal',
    description: 'View your job progress, approve quotes and pay invoices online with JobBuilda.',
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
    title: 'JobBuilda | Client Portal',
    description: 'View your job progress, approve quotes and pay invoices online with JobBuilda.',
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
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/jobbuilda_icon_32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/jobbuilda_icon_16.png" />
        <link rel="apple-touch-icon" href="/jobbuilda_icon_180.png" />
      </head>
      <body className={inter.className}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
