import type { Metadata } from 'next';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';
import GoogleAnalytics from '@/components/GoogleAnalytics';

export const metadata: Metadata = {
  metadataBase: new URL('https://jobbuilda.co.uk'),
  title: 'JobBuilda | Quotes, Invoices & Job Management for Tradespeople',
  description:
    'Manage jobs, create quotes, send invoices and track payments with JobBuilda. Built for electricians, plumbers, carpenters, builders and other tradespeople.',
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
    locale: 'en_GB',
    title: 'JobBuilda | Quotes, Invoices & Job Management for Tradespeople',
    description:
      'Manage jobs, create quotes, send invoices and track payments with JobBuilda. Built for electricians, plumbers, carpenters, builders and other tradespeople.',
    images: [
      {
        url: '/og_image.png',
        width: 1200,
        height: 630,
        alt: 'JobBuilda for tradespeople',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobBuilda | Quotes, Invoices & Job Management for Tradespeople',
    description:
      'Manage jobs, create quotes, send invoices and track payments with JobBuilda. Built for electricians, plumbers, carpenters, builders and other tradespeople.',
    images: ['/og_image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-white">
        <GoogleAnalytics />
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
