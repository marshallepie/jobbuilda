import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BROWSER_REHEARSAL_PROFILE_ENV = 'JOBBUILDA_BROWSER_REHEARSAL_PROFILE';
export const REHEARSAL_SUPABASE_REF = 'jwnfweldmfdeapfzfunq';
export const PRODUCTION_SUPABASE_REF = 'jnwxueomquywrqcgbgfd';
export const browserRehearsalServices = ['identity', 'clients', 'quoting', 'invoicing'] as const;

const providerEnvironmentPatterns = [
  /^(?:STRIPE|RESEND|ANTHROPIC)_/,
  /^(?:SMTP|SENDGRID|MAILGUN|TWILIO)_/,
  /^(?:AWS_|GOOGLE_|AZURE_)/,
];

export interface BrowserRehearsalConfiguration {
  host: '127.0.0.1';
  port: number;
  services: readonly typeof browserRehearsalServices[number][];
}

function requiredValue(environment: NodeJS.ProcessEnv, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} is required for the browser rehearsal profile`);
  return value;
}

function exactRehearsalUrl(value: string): boolean {
  return value === `https://${REHEARSAL_SUPABASE_REF}.supabase.co`;
}

function validPort(value: string | undefined): number {
  if (value === undefined || value === '') return 3000;
  if (!/^[1-9][0-9]{0,4}$/.test(value)) throw new Error('PORT must be a valid local TCP port');
  const port = Number(value);
  if (port > 65535) throw new Error('PORT must be a valid local TCP port');
  return port;
}

export function isBrowserRehearsalProfile(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment[BROWSER_REHEARSAL_PROFILE_ENV] === 'true';
}

/**
 * This is deliberately separate from JOBBUILDA_REHEARSAL_MODE. The browser
 * profile never bypasses containment; it starts only the reviewed MCP children.
 */
export function preflightBrowserRehearsal(
  environment: NodeJS.ProcessEnv = process.env,
  repositoryRoot = path.resolve(fileURLToPath(new URL('../../../..', import.meta.url))),
): BrowserRehearsalConfiguration {
  if (!isBrowserRehearsalProfile(environment)) {
    throw new Error(`${BROWSER_REHEARSAL_PROFILE_ENV}=true is required`);
  }
  if (environment.JOBBUILDA_REHEARSAL_MODE !== undefined) {
    throw new Error('JOBBUILDA_REHEARSAL_MODE is prohibited for the browser rehearsal profile');
  }
  if (requiredValue(environment, 'JOBBUILDA_REHEARSAL_SUPABASE_REF') !== REHEARSAL_SUPABASE_REF) {
    throw new Error('The browser rehearsal profile requires the approved rehearsal Supabase ref');
  }
  const supabaseUrl = requiredValue(environment, 'SUPABASE_URL');
  if (!exactRehearsalUrl(supabaseUrl)) {
    throw new Error('SUPABASE_URL must be the exact approved rehearsal project URL');
  }
  if (supabaseUrl.includes(PRODUCTION_SUPABASE_REF) || environment.JOBBUILDA_REHEARSAL_SUPABASE_REF === PRODUCTION_SUPABASE_REF) {
    throw new Error('The production Supabase ref is prohibited for browser rehearsal');
  }
  requiredValue(environment, 'SUPABASE_SERVICE_ROLE_KEY');
  requiredValue(environment, 'DATABASE_URL');
  requiredValue(environment, 'JWT_SECRET');
  if (environment.HOST !== undefined && environment.HOST !== '127.0.0.1') {
    throw new Error('HOST must be 127.0.0.1 for the browser rehearsal profile');
  }
  if (environment.NATS_URL !== undefined) {
    throw new Error('NATS_URL is prohibited: browser rehearsal starts its own no-consumer local capture');
  }
  for (const key of Object.keys(environment)) {
    if (providerEnvironmentPatterns.some((pattern) => pattern.test(key)) && environment[key]) {
      throw new Error(`${key} is prohibited: provider-capable configuration is not allowed in browser rehearsal`);
    }
  }
  for (const service of browserRehearsalServices) {
    const artifact = path.join(repositoryRoot, 'services', `${service}-mcp`, 'dist', 'index.js');
    if (!existsSync(artifact)) throw new Error(`Required MCP artifact is missing: ${artifact}`);
  }
  return { host: '127.0.0.1', port: validPort(environment.PORT), services: browserRehearsalServices };
}
