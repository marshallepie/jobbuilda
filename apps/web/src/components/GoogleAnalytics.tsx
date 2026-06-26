'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initGoogleAnalytics, trackPageView } from '@/lib/analytics';

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const syncAnalytics = () => {
      initGoogleAnalytics();
      const pagePath = `${window.location.pathname}${window.location.search}`;
      trackPageView(pagePath);
    };

    syncAnalytics();
    window.addEventListener('cookie-consent-updated', syncAnalytics);
    return () => window.removeEventListener('cookie-consent-updated', syncAnalytics);
  }, [pathname]);

  return null;
}
