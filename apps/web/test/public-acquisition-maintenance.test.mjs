import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function source(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('public acquisition routes render the maintenance notice without enrollment code', () => {
  const acquisitionPages = [
    'apps/web/src/app/signup/page.tsx',
    'apps/web/src/app/onboarding/page.tsx',
    'apps/web/src/app/verify/page.tsx',
    'apps/web/src/app/welcome/page.tsx',
    'apps/admin/src/app/signup/page.tsx',
    'apps/admin/src/app/onboarding/page.tsx',
  ];

  for (const page of acquisitionPages) {
    const content = source(page);
    assert.match(content, /import MaintenanceNotice from '@\/components\/MaintenanceNotice';/);
    assert.match(content, /return <MaintenanceNotice \/>;/);
    assert.doesNotMatch(content, /fetch\(|signUp|verifyOtp|loadStripe|sessionStorage/);
  }
});

test('public marketing keeps existing sign-in access but removes acquisition CTAs', () => {
  const homepage = source('apps/web/src/app/page.tsx');
  const privacy = source('apps/web/src/app/privacy/page.tsx');

  assert.match(homepage, /\/login/);
  assert.match(homepage, /MAINTENANCE_MESSAGE/);
  assert.doesNotMatch(homepage, /href="\/signup"/);
  assert.doesNotMatch(homepage, /PricingCard/);

  assert.match(privacy, /\/login/);
  assert.doesNotMatch(privacy, /href="\/signup"/);
});

test('admin login remains available but does not link to self-service signup', () => {
  const login = source('apps/admin/src/app/login/page.tsx');

  assert.match(login, /signIn\(email, password\)/);
  assert.match(login, /MAINTENANCE_MESSAGE/);
  assert.doesNotMatch(login, /href="\/signup"/);
});

test('maintenance notices do not promise unavailable quote-deposit checkout', () => {
  const notices = [
    source('apps/web/src/components/MaintenanceNotice.tsx'),
    source('apps/admin/src/components/MaintenanceNotice.tsx'),
  ];

  for (const notice of notices) {
    assert.match(notice, /customer invoice payments, payment history, and billing portal remain available/);
    assert.doesNotMatch(notice, /quote-deposit payments.*remain available/i);
  }
});
