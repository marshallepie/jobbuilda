import Link from 'next/link';
import PricingCard from '@/components/PricingCard';

const features = [
  {
    icon: '📋',
    title: 'Professional Quoting',
    description:
      'Create detailed quotes with materials and labour. Send to clients for online approval — no printing, no chasing.',
  },
  {
    icon: '🔧',
    title: 'Job Management',
    description:
      'Track every job from start to finish. Log time, record materials used, and manage multiple sites effortlessly.',
  },
  {
    icon: '📄',
    title: 'Instant Invoicing',
    description:
      'Generate invoices directly from completed jobs. Send professional PDFs and get paid faster.',
  },
  {
    icon: '📦',
    title: 'Materials Tracking',
    description:
      'Scan barcodes on-site to log materials used. Stay on top of costs and build accurate future quotes.',
  },
  {
    icon: '📊',
    title: 'Reporting & VAT',
    description:
      'See profit and loss at a glance. Generate HMRC-compliant VAT returns without a spreadsheet in sight.',
  },
  {
    icon: '🔒',
    title: 'Client Portal',
    description:
      'Give clients their own secure portal to view job progress, approve quotes, and pay invoices online.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600">JobBuilda</span>
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

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 sm:px-6 lg:px-8 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-blue-100 text-blue-700 text-sm font-medium px-3 py-1 rounded-full mb-6">
            Built for UK electrical contractors
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-6">
            The all-in-one app for
            <span className="text-blue-600"> electrical contractors</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Quotes, jobs, invoices, materials, and payments — all in one place. Stop juggling
            spreadsheets and paper and start running your business properly.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/signup"
              className="bg-blue-600 text-white px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
            >
              Start your 14-day free trial
            </Link>
            <a
              href="#pricing"
              className="border border-gray-200 text-gray-700 px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-gray-50 transition-colors"
            >
              See pricing
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-4">No commitment. Cancel anytime.</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Designed specifically for electrical contractors. Every feature solves a real problem
            you face on the job.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-xl border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-lg text-gray-600 mb-12">
            One plan. Everything included. Try it free for 14 days — card required, cancel anytime.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-start">
            <PricingCard
              name="Standard"
              price={29}
              description="For sole traders and small electrical businesses"
              features={[
                'Unlimited quotes & invoices',
                'Job management & time tracking',
                'Materials scanning & tracking',
                'Client portal',
                'VAT returns (HMRC-compliant)',
                'PDF certificates',
                'Email support',
              ]}
              highlight
              ctaHref="/signup"
              ctaLabel="Start 14-day free trial"
            />
            <PricingCard
              name="Additional Seats"
              price={9}
              priceNote="per extra team member / month"
              description="Add technicians to your account"
              features={[
                'Time tracking',
                'Materials scanning',
                'Job view & updates',
                'Mobile-friendly portal',
              ]}
              highlight={false}
              ctaHref="/signup"
              ctaLabel="Start free trial"
            />
          </div>
          <p className="text-sm text-gray-500 mt-8">
            All prices exclude VAT. Billed monthly. Cancel before the trial ends and you won&apos;t
            be charged.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-blue-600 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Join electrical contractors who use JobBuilda to win more jobs and get paid faster.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-white text-blue-600 px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-blue-50 transition-colors shadow-lg"
          >
            Start your free trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4 text-center text-sm text-gray-500">
        <p>© {new Date().getFullYear()} JobBuilda Ltd. All rights reserved.</p>
      </footer>
    </div>
  );
}
