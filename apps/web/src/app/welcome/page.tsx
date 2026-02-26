import Link from 'next/link';

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.jobbuilda.co.uk';

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <Link href="/" className="text-xl font-bold text-blue-600 block mb-8">
          JobBuilda
        </Link>

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">You&apos;re all set!</h1>
        <p className="text-gray-600 mb-2">
          Your 14-day free trial starts today. You won&apos;t be charged until the trial ends.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Head to your dashboard to create your first quote, add clients, and start managing jobs.
        </p>

        <a
          href={ADMIN_URL}
          className="block w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-center"
        >
          Go to your dashboard
        </a>

        <p className="text-xs text-gray-400 mt-4">
          Questions? Email us at{' '}
          <a href="mailto:hello@jobbuilda.co.uk" className="text-blue-600 hover:underline">
            hello@jobbuilda.co.uk
          </a>
        </p>
      </div>
    </div>
  );
}
