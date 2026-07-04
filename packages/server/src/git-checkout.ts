/**
 * Pure git work for `POST /api/git/checkout` — separated from the HTTP handler
 * so the sequencing (rev-parse → fetch → dirty-check → checkout) is testable
 * without spinning up a server.
 *
 * The handler in `api-extension.ts` wraps `runCheckoutFlow` in `withParentLock`
 * — the lock primitive is intentionally external so this module stays a pure
 * git driver with no transitive imports of the mutex (mirrors how
 * `dirtyFilesOverlapWith` and `computeBranchInfo` stay lock-free).
 *
 * Errors propagate as typed `CheckoutOutcome` values rather than thrown
 * exceptions — the handler maps them 1:1 to the wire envelope discriminator.
 * Unexpected throws still propagate; the handler's top-level catch maps them
 * to a 500 problem+json.
 */

import { realpathSync } from 'node:fs';
import { type CheckoutFailureReason, isBranchNotFoundGitError } from '@inkeep/open-knowledge-core';
import { dirtyFilesOverlapWith } from './git-dirty.ts';
import { createGitInstance } from './git-handle.ts';

export type CheckoutOutcome =
  | { ok: true }
  | {
      ok: false;
      reason: CheckoutFailureReason;
      files?: string[];
      /** Set iff `reason === 'branch-in-other-worktree'`. Realpath-collapsed. */
      otherWorktreePath?: string;
    };

/**
 * Match git's English-locale stderr for "branch already checked out in
 * another worktree." Capture group 1 holds the worktree path git reported.
 *
 * git phrases this two ways depending on version, so the alternation matches
 * both (LANG=C / LC_ALL=C in `createGitInstance` keeps the locale stable):
 *
 *   fatal: 'feat-bar' is already checked out at '/Users/.../wt/feat-bar'
 *   fatal: 'feat-bar' is already used by worktree at '/Users/.../wt/feat-bar'
 *
 * Older git (e.g. macOS system git) emits "checked out at"; newer git (e.g.
 * the Linux CI image) emits "used by worktree at". Matching only the former
 * silently drops the typed branch-in-other-worktree outcome on newer git,
 * collapsing the pivot into a generic checkout-failed.
 *
 * Branch names with single quotes inside them never reach here — git refuses
 * to create branches with single quotes (`refname` validation). A worktree
 * path containing a single quote is the only pathological case. The `[^']+`
 * path capture is bounded by the surrounding quotes, so such a path is
 * captured truncated at its first inner apostrophe (e.g.
 * `/Users/me/it's-fine/wt` captures as `/Users/me/it`). The truncated path
 * then fails `realpathSync` (or, rarely, resolves to a different existing
 * directory), falling back to the raw truncated path for the pivot display.
 * We deliberately do NOT anchor the closing quote to end-of-line to force a
 * clean miss on such paths: git's stderr can carry trailing `hint:` lines, and
 * an end-anchor would then break detection for ordinary paths. An apostrophe
 * in a worktree path is rare enough that the minor display truncation is an
 * acceptable trade for robust matching of the common case.
 */
const BRANCH_IN_OTHER_WORKTREE_RE =
  /'[^']+' is already (?:checked out|used by worktree) at '([^']+)'/;

/**
 * Detect the git stderr signature for "branch is checked out in another
 * worktree" and extract the realpath-collapsed held-at path. Exported so
 * the regex semantics are unit-testable without spinning up a real git
 * repo. Returns `{ held: false }` on no-match; on match, the caller decides
 * whether to surface the typed outcome or fall through to `checkout-failed`.
 */
export function isBranchInOtherWorktreeError(
  err: unknown,
): { held: true; path: string } | { held: false } {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const match = message.match(BRANCH_IN_OTHER_WORKTREE_RE);
  if (match === null) return { held: false };
  const rawPath = match[1];
  if (rawPath === undefined || rawPath.length === 0) return { held: false };
  // Realpath-collapse so the held-at path matches what listGitWorktrees
  // emits for the same worktree (the renderer compares them). If realpath
  // fails (the worktree was pruned between git's error and our handler
  // running), fall back to the raw path — the dialog still gets useful
  // display text.
  let canonicalPath: string;
  try {
    canonicalPath = realpathSync(rawPath);
  } catch {
    canonicalPath = rawPath;
  }
  return { held: true, path: canonicalPath };
}

/** Single source of truth for the handler tag used in logs + telemetry. */
export const CHECKOUT_HANDLER_TAG = 'git-checkout';

/**
 * Returns true when `error` is a simple-git / git CLI failure whose message
 * indicates the requested branch does not exist on the remote.
 *
 * Thin re-export of `isBranchNotFoundGitError` from `@inkeep/open-knowledge-core`
 * — see that function for the canonical pattern. The wrapper here preserves
 * the named export so existing imports (`api-extension.ts`, this module) keep
 * their paths; the implementation is centralized so the cli-side
 * `isBranchNotFoundError` (in `packages/cli/src/commands/clone.ts`) cannot
 * drift from the server-side classifier again.
 *
 * `createGitInstance` spawns git with `LANG=C`/`LC_ALL=C` so stderr is always
 * English regardless of the receiver's host locale. Exported so the
 * LANG-stabilization can be regression-tested without standing up a real
 * git repo.
 */
export const isBranchNotFoundFetchError = isBranchNotFoundGitError;

/**
 * Run the checkout flow against `projectDir` targeting `branch`.
 *
 * Sequencing (each step's result gates the next — sequential by data dep):
 *   1. `git rev-parse --verify refs/heads/<branch>` — branch local?
 *   2. If not local → `git fetch origin <branch>`. Classify fetch failure
 *      via `isBranchNotFoundFetchError` to discriminate
 *      `branch-not-found` vs `fetch-failed`.
 *   3. `dirtyFilesOverlapWith(projectDir, branch)` — re-check on the
 *      authoritative refs after a successful fetch (the fetch may have
 *      advanced refs and changed the overlap set).
 *   4. `git checkout <branch>` — return `ok: true` on success,
 *      `checkout-failed` on any thrown error.
 *
 * No internal try/catch wraps the whole flow — errors at each step are
 * either mapped to a typed outcome (steps 2, 4) or propagated to the
 * handler boundary for the catch-all 500 path.
 */
export async function runCheckoutFlow(
  projectDir: string,
  branch: string,
): Promise<CheckoutOutcome> {
  const { git } = createGitInstance(projectDir);

  const branchIsLocal = await git
    .raw(['rev-parse', '--verify', `refs/heads/${branch}`])
    .then(() => true)
    .catch(() => false);

  if (!branchIsLocal) {
    try {
      await git.raw(['fetch', 'origin', branch]);
    } catch (err) {
      return {
        ok: false,
        reason: isBranchNotFoundFetchError(err) ? 'branch-not-found' : 'fetch-failed',
      };
    }
  }

  // Re-check dirty overlap against the ref git will actually switch to.
  // When the branch is local, that ref is `refs/heads/<branch>`; when we
  // just fetched, the local ref doesn't exist yet and `dirtyFilesOverlapWith`
  // would fail to resolve `<branch>` — fall back to `origin/<branch>` (the
  // ref the fetch populated), which is the same commit `git checkout` will
  // auto-track from.
  const targetRef = branchIsLocal ? branch : `origin/${branch}`;
  const overlap = await dirtyFilesOverlapWith(projectDir, targetRef);
  if (overlap.conflicts) {
    return { ok: false, reason: 'dirty-conflict', files: overlap.files };
  }

  try {
    await git.raw(['checkout', branch]);
    return { ok: true };
  } catch (err) {
    // Discriminate "branch is checked out in another worktree" — git refuses
    // the checkout in that case, and the multi-worktree share-receive flow
    // pivots the dialog to "Open that worktree instead". The classifier
    // returns `held: false` on any non-match, falling through to the legacy
    // `checkout-failed` catch-all without functional regression.
    const heldElsewhere = isBranchInOtherWorktreeError(err);
    if (heldElsewhere.held) {
      console.warn(
        `[git-checkout] reason=branch-in-other-worktree branch=${branch} held_at=${heldElsewhere.path}`,
      );
      return {
        ok: false,
        reason: 'branch-in-other-worktree',
        otherWorktreePath: heldElsewhere.path,
      };
    }
    // Symmetric observability with the fetch-failure path above: precondition
    // gates (rev-parse, fetch, dirty-overlap) all passed, so the most likely
    // causes are lock contention, filesystem permissions, or partial merge
    // state — which are the hardest to reproduce without a stderr breadcrumb.
    const message = err instanceof Error ? err.message : String(err);
    const truncated = message.length > 500 ? `${message.slice(0, 500)}…` : message;
    console.warn(`[git-checkout] action=checkout-failed branch=${branch} error=${truncated}`);
    return { ok: false, reason: 'checkout-failed' };
  }
}
