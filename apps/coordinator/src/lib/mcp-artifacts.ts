import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_REHEARSAL_MCP_SERVICES = ['identity', 'clients', 'quoting', 'invoicing'] as const;
export type RehearsalMcpService = typeof REQUIRED_REHEARSAL_MCP_SERVICES[number];
export type McpEntrypoints = Record<RehearsalMcpService, string>;

/**
 * Resolve repository artifacts from this module's installed/source location, not
 * from process.cwd(). This works for both tsx source execution and compiled
 * coordinator output because both locations are rooted under apps/coordinator.
 */
export function resolveRehearsalMcpEntrypoints(moduleUrl = import.meta.url): McpEntrypoints {
  const moduleDir = path.dirname(fileURLToPath(moduleUrl));
  const repositoryRoot = path.resolve(moduleDir, '../../../..');
  const entrypoint = (service: string) => path.join(repositoryRoot, 'services', `${service}-mcp`, 'dist', 'index.js');

  return {
    identity: entrypoint('identity'),
    clients: entrypoint('clients'),
    quoting: entrypoint('quoting'),
    invoicing: entrypoint('invoicing'),
  };
}

/** Fail before any NATS connection, MCP child spawn, or Auth fixture mutation. */
export function assertRequiredRehearsalMcpArtifacts(entrypoints = resolveRehearsalMcpEntrypoints()): McpEntrypoints {
  const missing = REQUIRED_REHEARSAL_MCP_SERVICES.filter((service) => !existsSync(entrypoints[service]));
  if (missing.length > 0) {
    throw new Error(`REHEARSAL_BLOCKED: artifact-preflight failed: missing required MCP dist entrypoint(s): ${missing.join(', ')}`);
  }
  return entrypoints;
}
