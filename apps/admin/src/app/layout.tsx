import type { Metadata } from 'next';
import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
