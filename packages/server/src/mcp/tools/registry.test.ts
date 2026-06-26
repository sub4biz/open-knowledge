import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Config, ConfigSchema } from '../../config/schema.ts';
import { registerAllTools } from './index.ts';
import type { ServerInstance } from './shared.ts';

const BASE_CONFIG: Config = ConfigSchema.parse({});

const EXPECTED_TOOLS = [
  'exec',
  'search',
  'history',
  'links',
  'skills',
  'config',
  'palette',
  'preview_url',
  'share_link',
  'write',
  'edit',
  'delete',
  'move',
  'install',
  'checkpoint',
  'restore_version',
  'conflicts',
  'resolve_conflict',
  'workflow',
] as const;

const RETIRED_TOOL_NAMES = [
  'get_backlinks',
  'get_forward_links',
  'get_dead_links',
  'get_orphans',
  'get_hubs',
  'suggest_links',
  'rename_document',
  'rename_folder',
  'save_version',
  'rollback_to_version',
  'version',
  'set_folder_rule',
  'write_template',
  'delete_template',
  'frontmatter_patch',
  'write_document',
  'edit_document',
  'edit_frontmatter',
  'delete_document',
  'rename',
  'folder_config',
  'read_document',
  'grep',
  'list_documents',
  'get_components',
  'get_authoring_palette',
  'ingest',
  'research',
  'consolidate',
  'discover',
  'get_history',
  'get_config',
  'get_preview_url',
] as const;

function captureRegistered(): string[] {
  const names: string[] = [];
  const cwd = mkdtempSync(join(tmpdir(), 'ok-registry-assertion-'));
  const server = {
    registerTool(name: string, _cfg: unknown, _handler: unknown) {
      names.push(name);
    },
    tool() {
      throw new Error('legacy tool() API not expected — every tool must use registerTool');
    },
  } as unknown as ServerInstance;
  registerAllTools(server, {
    config: BASE_CONFIG,
    resolveCwd: async () => cwd,
    serverUrl: undefined,
  });
  return names;
}

describe('registerAllTools — 19-tool surface (SPEC.md §9.1 / AC8 + PRD-6935 install + skills read)', () => {
  test('registers exactly 19 tools', () => {
    const names = captureRegistered();
    expect(names.length).toBe(19);
  });

  test('the 19 expected tool names are all present', () => {
    const names = new Set(captureRegistered());
    for (const expected of EXPECTED_TOOLS) {
      expect(names).toContain(expected);
    }
  });

  test('none of the 17 pre-consolidation tool names are registered', () => {
    const names = new Set(captureRegistered());
    for (const retired of RETIRED_TOOL_NAMES) {
      expect(names.has(retired)).toBe(false);
    }
  });

  test('the registered set matches the expected set exactly (no extras)', () => {
    const names = new Set(captureRegistered());
    expect(names).toEqual(new Set(EXPECTED_TOOLS));
  });

  test('no duplicate registrations', () => {
    const names = captureRegistered();
    expect(names.length).toBe(new Set(names).size);
  });
});
