import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — JobBuilda',
  description: 'How JobBuilda collects, uses, and protects your personal data.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-600">
            JobBuilda
          </Link>
          <div className="flex items-center gap-4">
            <a
              href={`${process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.jobbuilda.co.uk'}/login`}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Sign in
            </a>
            <Link
              href="/signup"
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: 5 March 2026</p>

        <div className="prose prose-gray max-w-none space-y-10 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Who we are</h2>
            <p>
              JobBuilda is a software platform for electrical contractors, operated by JobBuilda Ltd
              (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). Our registered address and contact
              details are available on request at{' '}
              <a href="mailto:hello@jobbuilda.co.uk" className="text-blue-600 hover:underline">
                hello@jobbuilda.co.uk
              </a>.
            </p>
            <p className="mt-3">
              We are the <strong>data controller</strong> for personal data you provide to us when
              using our website and services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. What data we collect</h2>
            <p>We collect only what is necessary to provide the service:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Account data</strong>: name, email address, business name, and phone number
                when you register.
              </li>
              <li>
                <strong>Business data</strong>: clients, sites, quotes, jobs, invoices, and payments
                you enter into the platform.
              </li>
              <li>
                <strong>Client data</strong>: names, addresses, and contact details of your clients
                that you add to the platform. You are responsible for having a lawful basis to share
                this data with us.
              </li>
              <li>
                <strong>Payment data</strong>: billing information processed securely by Stripe. We
                do not store card numbers on our servers.
              </li>
              <li>
                <strong>Usage data</strong>: log data such as IP address, browser type, and pages
                visited, used to maintain security and diagnose issues.
              </li>
              <li>
                <strong>Cookies</strong>: see Section 7 below.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How we use your data</h2>
            <p>We use your personal data to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Provide, maintain, and improve the JobBuilda platform.</li>
              <li>Process payments and manage your subscription.</li>
              <li>Send transactional emails (account verification, invoices, password resets).</li>
              <li>Respond to support requests.</li>
              <li>Meet our legal and regulatory obligations.</li>
            </ul>
            <p className="mt-4">
              <strong>We do not sell your data</strong> to third parties. We do not use your data
              for advertising or profiling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Legal basis for processing</h2>
            <p>We rely on the following legal bases under UK GDPR:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Contract performance</strong>: processing necessary to deliver the service
                you have subscribed to.
              </li>
              <li>
                <strong>Legitimate interests</strong>: security monitoring, fraud prevention, and
                service improvement.
              </li>
              <li>
                <strong>Legal obligation</strong>: retaining financial records as required by HMRC.
              </li>
              <li>
                <strong>Consent</strong>: where we ask for your consent (e.g. non-essential cookies),
                you may withdraw it at any time.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. How long we keep your data</h2>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Account data</strong>: retained while your account is active and for up to
                7 years after closure (HMRC record-keeping requirements).
              </li>
              <li>
                <strong>Financial records</strong> (invoices, payments): 7 years from the date of
                transaction.
              </li>
              <li>
                <strong>Usage logs</strong>: up to 90 days.
              </li>
              <li>
                <strong>Client data you enter</strong>: deleted within 30 days of your written
                request, unless we are legally required to retain it.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Sharing your data</h2>
            <p>
              We share personal data only with trusted sub-processors necessary to run the service:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>
                <strong>Supabase</strong> — database hosting (EU region)
              </li>
              <li>
                <strong>Railway / Vercel</strong> — application hosting (EU/US)
              </li>
              <li>
                <strong>Stripe</strong> — payment processing (UK/EU)
              </li>
              <li>
                <strong>Resend</strong> — transactional email delivery
              </li>
            </ul>
            <p className="mt-4">
              All sub-processors are contractually required to protect your data in accordance with
              UK GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Cookies</h2>
            <p>
              We currently use <strong>essential cookies only</strong>. These are strictly necessary
              to keep you signed in and make the platform function correctly. We do not use tracking,
              analytics, or advertising cookies.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Cookie</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Purpose</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">sb-*</td>
                    <td className="px-4 py-2">Supabase authentication session</td>
                    <td className="px-4 py-2">Session / 1 week</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-mono text-xs">jb_cookie_consent</td>
                    <td className="px-4 py-2">Records your cookie preference</td>
                    <td className="px-4 py-2">1 year (localStorage)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              You can clear cookies and localStorage at any time through your browser settings. This
              will sign you out of the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your rights</h2>
            <p>Under UK GDPR you have the right to:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li><strong>Access</strong> the personal data we hold about you.</li>
              <li><strong>Correct</strong> inaccurate or incomplete data.</li>
              <li>
                <strong>Erase</strong> your data (&ldquo;right to be forgotten&rdquo;), subject to
                legal retention requirements.
              </li>
              <li>
                <strong>Restrict</strong> processing in certain circumstances.
              </li>
              <li>
                <strong>Data portability</strong> — receive a copy of your data in a
                machine-readable format.
              </li>
              <li>
                <strong>Object</strong> to processing based on legitimate interests.
              </li>
              <li>
                <strong>Withdraw consent</strong> at any time where processing is based on consent.
              </li>
            </ul>
            <p className="mt-4">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:privacy@jobbuilda.co.uk" className="text-blue-600 hover:underline">
                privacy@jobbuilda.co.uk
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Security</h2>
            <p>
              We take reasonable technical and organisational measures to protect your data, including
              encrypted connections (TLS), access controls, and regular security reviews. However, no
              internet transmission is 100% secure and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. When we make significant changes we will
              notify you by email or via an in-app notice. The &ldquo;Last updated&rdquo; date at the
              top of this page always reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contact &amp; complaints</h2>
            <p>
              For any privacy queries, contact us at{' '}
              <a href="mailto:privacy@jobbuilda.co.uk" className="text-blue-600 hover:underline">
                privacy@jobbuilda.co.uk
              </a>.
            </p>
            <p className="mt-3">
              If you are unhappy with how we have handled your data, you have the right to lodge a
              complaint with the{' '}
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Information Commissioner&rsquo;s Office (ICO)
              </a>
              , the UK supervisory authority for data protection.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-sm text-gray-500 flex flex-col sm:flex-row justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} JobBuilda Ltd. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-gray-700">
              Privacy Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
