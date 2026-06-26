import { describe, expect, test } from 'bun:test';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import type { ServerInstance } from './shared.ts';
import { register as registerSkills, type SkillsToolDeps } from './skills.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: true;
}
type Handler = (args: Record<string, unknown>) => Promise<ToolResult>;

function captureSkills(serverUrl: string | undefined): Handler {
  let handler: Handler | undefined;
  const server = {
    registerTool(_name: string, _cfg: unknown, h: Handler) {
      handler = h;
    },
  } as unknown as ServerInstance;
  registerSkills(server, {
    serverUrl,
    config: BASE_CONFIG,
    resolveCwd: async () => process.cwd(),
  } as unknown as SkillsToolDeps);
  if (!handler) throw new Error('tool did not register');
  return handler;
}

const text = (r: ToolResult) => r.content.map((c) => c.text).join('\n');

describe('skills read tool — bundle-file gating short-circuits before the network', () => {
  const UNREACHABLE = 'http://127.0.0.1:1';

  test('`file` without `name` returns the teaching error', async () => {
    const handler = captureSkills(UNREACHABLE);
    const r = await handler({ file: 'references/x.md' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('pass `name` too');
  });

  test('`file` with an escaping path is rejected by the allowlist', async () => {
    const handler = captureSkills(UNREACHABLE);
    const r = await handler({ name: 'trip-log', file: 'references/../../etc/passwd' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('..');
  });

  test('`file` outside references/ or scripts/ is rejected', async () => {
    const handler = captureSkills(UNREACHABLE);
    const r = await handler({ name: 'trip-log', file: 'notes/x.md' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('references/');
  });
});

describe('skills read tool — server-required', () => {
  test('no server URL returns the not-running error', async () => {
    const handler = captureSkills(undefined);
    const r = await handler({ name: 'trip-log' });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain('Hocuspocus server is not running');
  });
});
