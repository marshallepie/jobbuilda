import Link from 'next/link';

export const MAINTENANCE_MESSAGE =
  'New JobBuilda registrations, free trials, and subscription checkout are temporarily paused for maintenance. Existing account access, customer invoice and quote-deposit payments, payment history, and billing portal remain available.';

export default function MaintenanceNotice() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4" aria-labelledby="maintenance-heading">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <Link href="/" className="text-xl font-bold text-primary-600 inline-block mb-8">
          JobBuilda
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5" role="status">
          <h1 id="maintenance-heading" className="text-xl font-semibold text-gray-900 mb-3">
            Maintenance in progress
          </h1>
          <p className="text-gray-700 leading-relaxed">{MAINTENANCE_MESSAGE}</p>
        </div>
      </div>
    </main>
  );
}
