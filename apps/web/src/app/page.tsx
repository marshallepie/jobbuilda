import Image from 'next/image';
import { MAINTENANCE_MESSAGE } from '@/components/MaintenanceNotice';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Image src="/jobbuilda_logo_full.png" alt="JobBuilda" width={140} height={46} priority />
          <a
            href={`${process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.jobbuilda.co.uk'}/login`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign in
          </a>
        </div>
      </nav>

      <main className="px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <p className="inline-block bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1 rounded-full mb-6">
            Maintenance in progress
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            Maintenance in progress
          </h1>
          <p className="text-xl text-gray-700 leading-relaxed">{MAINTENANCE_MESSAGE}</p>
        </div>
      </main>

      <footer className="border-t border-gray-100 py-8 px-4 text-center text-sm text-gray-500 bg-white">
        <p>© {new Date().getFullYear()} JobBuilda Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
}
