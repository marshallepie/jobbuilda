import Link from 'next/link';

interface PricingCardProps {
  name: string;
  price: number;
  priceNote?: string;
  description: string;
  features: string[];
  highlight: boolean;
  ctaHref: string;
  ctaLabel: string;
}

export default function PricingCard({
  name,
  price,
  priceNote,
  description,
  features,
  highlight,
  ctaHref,
  ctaLabel,
}: PricingCardProps) {
  return (
    <div
      className={`flex-1 max-w-sm rounded-2xl p-8 text-left ${
        highlight
          ? 'bg-white border-2 border-blue-600 shadow-xl shadow-blue-100'
          : 'bg-white border border-gray-200'
      }`}
    >
      {highlight && (
        <div className="inline-block bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
          Most popular
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>

      <div className="mb-6">
        <span className="text-4xl font-bold text-gray-900">£{price}</span>
        <span className="text-gray-500 text-sm ml-1">{priceNote || '/ month'}</span>
      </div>

      <ul className="space-y-3 mb-8">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
            <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {f}
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-colors ${
          highlight
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
