import { describe, expect, test } from 'bun:test';
import { STARTER_PACK_IDS, STARTER_PACKS } from './starter.ts';

/**
 * Every user-facing string a starter pack ships: pack name/description, each
 * folder's title/description, every template body, and every root file
 * (e.g. log.md). These land in front of novices at first project setup and
 * inside their first documents, so they must stay free of insider jargon.
 */
function userFacingStrings(): string[] {
  const out: string[] = [];
  for (const id of STARTER_PACK_IDS) {
    const pack = STARTER_PACKS[id];
    out.push(pack.name, pack.description);
    for (const folder of pack.folders) {
      out.push(folder.title, folder.description);
    }
    out.push(...Object.values(pack.templates));
    if (pack.rootFiles) out.push(...Object.values(pack.rootFiles));
  }
  return out;
}

describe('starter packs — no insider jargon in user-facing copy', () => {
  // "sweep" (agent-scan jargon) leaked into folder descriptions and a daily-note
  // template body; novices reading "(also in frontmatter for sweeps)" in their
  // own journal had no way to know what it meant. Guard against regressions.
  test('no "sweep" in any folder description, template body, or root file', () => {
    const offenders = userFacingStrings().filter((s) => /\bsweeps?\b/i.test(s));
    expect(offenders).toEqual([]);
  });
});
