import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  assertRequiredRehearsalMcpArtifacts,
  resolveRehearsalMcpEntrypoints,
} from '../src/lib/mcp-artifacts.js';

test('rehearsal MCP entrypoints are absolute and independent of the launch CWD', () => {
  const originalCwd = process.cwd();
  try {
    process.chdir('/');
    const entrypoints = resolveRehearsalMcpEntrypoints();
    const verified = assertRequiredRehearsalMcpArtifacts(entrypoints);

    for (const [service, entrypoint] of Object.entries(verified)) {
      assert.equal(path.isAbsolute(entrypoint), true, `${service} entrypoint must be absolute`);
      assert.match(entrypoint, /\/services\/[a-z-]+-mcp\/dist\/index\.js$/);
    }
    assert.notEqual(verified.identity, path.resolve(process.cwd(), '../../services/identity-mcp/dist/index.js'));
  } finally {
    process.chdir(originalCwd);
  }
});

test('artifact preflight reports only missing service names before startup', () => {
  const entrypoints = resolveRehearsalMcpEntrypoints();
  assert.throws(
    () => assertRequiredRehearsalMcpArtifacts({ ...entrypoints, quoting: '/not-a-worktree/quoting-mcp/dist/index.js' }),
    /REHEARSAL_BLOCKED: artifact-preflight failed: missing required MCP dist entrypoint\(s\): quoting/,
  );
});
