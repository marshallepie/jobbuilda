import Link from 'next/link';

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <Link href="/" className="text-xl font-bold text-blue-600 block mb-8">
          JobBuilda
        </Link>

        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M10.29 3.86L2.82 16.33A2 2 0 004.53 19h14.94a2 2 0 001.71-2.67L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-3">New account enrollment temporarily paused</h1>
        <p className="text-gray-600 mb-4">
          JobBuilda is undergoing maintenance. New-account verification, free-trial enrollment, and subscription signup are temporarily paused.
        </p>
        <p className="text-sm text-gray-500">
          Existing users and customers can continue to access accounts and make invoice or quote-deposit payments.
        </p>
      </div>
    </div>
  );
}
