export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

export const GA_LINKER_DOMAINS = (process.env.NEXT_PUBLIC_GA_LINKER_DOMAINS ?? '')
  .split(',')
  .map((domain) => domain.trim())
  .filter(Boolean);

export interface GoogleAnalyticsConfig {
  page_path: string;
  send_page_view?: boolean;
  linker?: {
    domains: string[];
    accept_incoming: boolean;
  };
}

export function buildGoogleAnalyticsConfig(pagePath: string): GoogleAnalyticsConfig {
  return {
    page_path: pagePath,
    send_page_view: false,
    ...(GA_LINKER_DOMAINS.length > 0
      ? {
          linker: {
            domains: GA_LINKER_DOMAINS,
            accept_incoming: true,
          },
        }
      : {}),
  };
}

declare global {
  interface Window {
    dataLayer: Array<Record<string, unknown>>;
    gtag?: (
      command: 'config' | 'event' | 'js',
      targetIdOrName: string | Date,
      params?: GoogleAnalyticsConfig | Record<string, unknown>
    ) => void;
    __gaInitialized?: boolean;
  }
}

const CONSENT_KEY = 'jb_cookie_consent';

function hasAnalyticsConsent() {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as { level?: 'all' | 'essential' };
    return parsed.level === 'all';
  } catch {
    return false;
  }
}

export function initGoogleAnalytics() {
  if (
    typeof window === 'undefined' ||
    !GA_MEASUREMENT_ID ||
    window.__gaInitialized ||
    !hasAnalyticsConsent()
  ) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(...args: unknown[]) {
    window.dataLayer.push(args as unknown as Record<string, unknown>);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, buildGoogleAnalyticsConfig(window.location.pathname));

  const existingScript = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`
  );

  if (!existingScript) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    document.head.appendChild(script);
  }

  window.__gaInitialized = true;
}

export function trackPageView(pagePath: string) {
  if (
    typeof window === 'undefined' ||
    !GA_MEASUREMENT_ID ||
    typeof window.gtag !== 'function' ||
    !hasAnalyticsConsent()
  ) {
    return;
  }

  window.gtag('config', GA_MEASUREMENT_ID, buildGoogleAnalyticsConfig(pagePath));
}
