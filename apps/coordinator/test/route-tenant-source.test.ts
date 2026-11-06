import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const routesDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/routes');

test('recovery handlers derive tenant context server-side and retain no caller-selected tenant header', () => {
  for (const route of ['identity.ts', 'clients.ts', 'quoting.ts', 'invoicing.ts']) {
    const source = readFileSync(path.join(routesDirectory, route), 'utf8');
    assert.match(source, /extractAuthContext\(request\)/, route);
    assert.doesNotMatch(source, /headers\[['"]x-tenant-id['"]\]/, route);
  }
});
