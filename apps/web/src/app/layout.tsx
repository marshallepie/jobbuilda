import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JobBuilda — Software for Electrical Contractors',
  description:
    'The all-in-one app for electrical contractors. Manage quotes, jobs, invoices, and payments — all in one place.',
  openGraph: {
    title: 'JobBuilda',
    description: 'The all-in-one app for electrical contractors.',
    url: 'https://jobbuilda.co.uk',
    siteName: 'JobBuilda',
    locale: 'en_GB',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased text-gray-900 bg-white">{children}</body>
    </html>
  );
}
