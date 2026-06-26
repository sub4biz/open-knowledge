import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestServer, pollUntil, type TestServer } from './test-harness.ts';

describe('skill bundle files via /api/skill-file', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await createTestServer();
  });
  afterEach(async () => {
    await server.cleanup();
  });

  const base = () => `http://127.0.0.1:${server.port}`;

  async function putSkill(name: string, description: string, body: string): Promise<void> {
    const res = await fetch(`${base()}/api/skill`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scope: 'project', body, frontmatter: { name, description } }),
    });
    if (!res.ok) throw new Error(`skill PUT failed: ${res.status} ${await res.text()}`);
  }

  async function putSkillFile(name: string, path: string, content: string) {
    const res = await fetch(`${base()}/api/skill-file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scope: 'project', path, content }),
    });
    return res;
  }

  test('a project .md reference persists as a content doc and joins the link graph', async () => {
    await putSkill('demo', 'a demo skill', '# Demo\n\nSee references.\n');

    const refRes = await putSkillFile(
      'demo',
      'references/notes.md',
      '# Notes\n\nSee [[target-doc]] for context.\n',
    );
    expect(refRes.ok).toBe(true);
    const refBody = (await refRes.json()) as { kind: string; content: boolean; path: string };
    expect(refBody.kind).toBe('reference');
    expect(refBody.content).toBe(true);

    const refFile = resolve(server.contentDir, '.ok', 'skills', 'demo', 'references', 'notes.md');
    await pollUntil(() => existsSync(refFile));
    expect(readFileSync(refFile, 'utf-8')).toContain('[[target-doc]]');

    const target = await fetch(`${base()}/api/agent-write-md`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        docName: 'target-doc',
        markdown: '# Target\n\nBody.\n',
        position: 'replace',
      }),
    });
    expect(target.ok).toBe(true);

    await pollUntil(async () => {
      const res = await fetch(`${base()}/api/backlinks?docName=target-doc`);
      const data = (await res.json()) as { backlinks?: Array<{ source: string }> };
      return (
        Array.isArray(data.backlinks) &&
        data.backlinks.some((b) => b.source === '.ok/skills/demo/references/notes')
      );
    });
  });

  async function renameSkill(fromName: string, toName: string) {
    const res = await fetch(`${base()}/api/skill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'project', fromName, toName }),
    });
    return res;
  }

  async function backlinkSources(target: string): Promise<string[]> {
    const res = await fetch(`${base()}/api/backlinks?docName=${encodeURIComponent(target)}`);
    const data = (await res.json()) as { backlinks?: Array<{ source: string }> };
    return Array.isArray(data.backlinks) ? data.backlinks.map((b) => b.source) : [];
  }

  test('a renamed skill re-indexes its moved .md references into the link graph (no rescan)', async () => {
    await putSkill('demo3', 'a demo skill', '# Demo\n\nSee references.\n');
    const refRes = await putSkillFile(
      'demo3',
      'references/notes.md',
      '# Notes\n\nSee [[move-target]] for context.\n',
    );
    expect(refRes.ok).toBe(true);

    const target = await fetch(`${base()}/api/agent-write-md`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docName: 'move-target', markdown: '# Target\n', position: 'replace' }),
    });
    expect(target.ok).toBe(true);

    await pollUntil(async () =>
      (await backlinkSources('move-target')).includes('.ok/skills/demo3/references/notes'),
    );

    const moved = await renameSkill('demo3', 'demo3-renamed');
    expect(moved.ok).toBe(true);

    await pollUntil(async () =>
      (await backlinkSources('move-target')).includes('.ok/skills/demo3-renamed/references/notes'),
    );
    const sources = await backlinkSources('move-target');
    expect(sources).not.toContain('.ok/skills/demo3/references/notes');
  }, 20000);

  test('a script round-trips through the universal per-file read (no native cat)', async () => {
    await putSkill('runner', 'runs things', '# Runner\n');
    const scriptText = '#!/usr/bin/env bash\nset -euo pipefail\necho "hello from a skill script"\n';
    const put = await putSkillFile('runner', 'scripts/run.sh', scriptText);
    expect(put.ok).toBe(true);
    const putBody = (await put.json()) as { kind: string; content: boolean };
    expect(putBody.kind).toBe('script');
    expect(putBody.content).toBe(false);

    const params = new URLSearchParams({
      name: 'runner',
      scope: 'project',
      path: 'scripts/run.sh',
    });
    const get = await fetch(`${base()}/api/skill-file?${params.toString()}`);
    expect(get.ok).toBe(true);
    const got = (await get.json()) as { path: string; kind: string; text: string };
    expect(got.kind).toBe('script');
    expect(got.text).toBe(scriptText);
  });

  test('a .mdx reference opens when requested as .md (extension-less node fallback)', async () => {
    await putSkill('mdxskill', 'has an mdx ref', '# Mdx\n');
    const put = await putSkillFile('mdxskill', 'references/guide.mdx', '# Guide\n\nMDX body.\n');
    expect(put.ok).toBe(true);

    const onDisk = resolve(
      server.contentDir,
      '.ok',
      'skills',
      'mdxskill',
      'references',
      'guide.mdx',
    );
    await pollUntil(() => existsSync(onDisk));

    const params = new URLSearchParams({
      name: 'mdxskill',
      scope: 'project',
      path: 'references/guide.md',
    });
    const get = await fetch(`${base()}/api/skill-file?${params.toString()}`);
    expect(get.ok).toBe(true);
    const got = (await get.json()) as { path: string; kind: string; text: string };
    expect(got.text).toContain('MDX body.');
    expect(got.path).toBe('references/guide.mdx');
    expect(got.kind).toBe('reference');
  });

  test('rejects an escaping path and a file write into a non-existent skill', async () => {
    await putSkill('demo2', 'd', '# D\n');
    const escaping = await putSkillFile('demo2', 'references/../../escape.md', 'x');
    expect(escaping.status).toBe(400);

    const ghost = await putSkillFile('ghost-skill', 'references/x.md', 'x');
    expect(ghost.status).toBe(404);
  });
});
