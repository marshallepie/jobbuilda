import Link from 'next/link';

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <Link href="/" className="text-xl font-bold text-blue-600 block mb-8">
          JobBuilda
        </Link>

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your inbox</h1>
        <p className="text-gray-600 mb-4">
          We&apos;ve sent you a verification link. Click it to continue setting up your account and
          adding your payment details.
        </p>
        <p className="text-sm text-gray-500">
          Can&apos;t find the email? Check your spam folder, or{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            try signing up again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
