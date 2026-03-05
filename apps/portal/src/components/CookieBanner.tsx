'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'jb_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) {
      setVisible(true);
    }
  }, []);

  const accept = (level: 'all' | 'essential') => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ level, date: new Date().toISOString() }));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 text-sm text-gray-700">
          <p>
            <strong>We use cookies</strong> to keep you signed in and make this portal work properly.
            We currently use <strong>essential cookies only</strong> — no tracking or advertising.{' '}
            <a
              href="https://jobbuilda.co.uk/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-sky-600 hover:text-sky-700 whitespace-nowrap"
            >
              Privacy Policy
            </a>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accept('essential')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
          >
            Essential Only
          </button>
          <button
            onClick={() => accept('all')}
            className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
