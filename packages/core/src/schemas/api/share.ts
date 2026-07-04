/**
 * share/virality flow.
 *
 * `handleShareConstructUrl` reads the project's local git state — HEAD branch,
 * `[remote "origin"] url`, and `refs/remotes/origin/<branch>` — and emits a
 * marketing-safe share URL (`https://openknowledge.ai/d/<base64url>`). The
 * endpoint is read-only against the local working tree and uses local refs
 * only (no `git ls-remote`) to keep the click-to-clipboard path under the
 * 100ms p95 budget.
 *
 * Wire contract returns HTTP 200 for BOTH the happy path and the five
 * business-logic failures (no-remote / detached-head / branch-not-on-origin /
 * non-github-remote / invalid-path) — discriminated on `ok`. This is a
 * deliberate departure from the RFC 9457 problem+json convention used
 * elsewhere in the API: the share UI maps each failure code to a per-toast
 * string, and routing those branches through 4xx would conflate them with
 * transport errors (network drops, CSRF gate rejections) the client retries
 * differently. Wire transport errors still surface as RFC 9457 problem+json
 * via `errorResponse` (loopback gate, payload-too-large, 500s).
 */

import type { StandardSchemaV1 } from '@standard-schema/spec';
import { z } from 'zod';

/**
 * Request body for `POST /api/share/construct-url`, discriminated on `kind`.
 *
 * - `doc` variant — `docPath` is the focused doc's content-dir-relative path
 *   (forward-slash separated, no leading slash, no `..` segments, no `.git`
 *   segments — see `invalid-path` below). Always names a file, so non-empty.
 * - `folder` variant — `folderPath` is the content-dir-relative folder path.
 *   Empty string is the root sentinel (the content root maps to
 *   `tree/<branch>/<content.dir>`, degenerating to `tree/<branch>` when
 *   `content.dir === '.'`), so `folderPath` carries NO `.min(1)`.
 *
 * `.loose()` rides on each member object — the discriminated union itself
 * can't carry passthrough; the members are what need forward-compat for
 * additive fields (identity, etc.).
 */
export const ShareConstructUrlRequestSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('doc'),
      docPath: z.string().min(1),
    })
    .loose(),
  z
    .object({
      kind: z.literal('folder'),
      folderPath: z.string(),
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type ShareConstructUrlRequest = z.infer<typeof ShareConstructUrlRequestSchema>;

/**
 * Closed enum of business-logic failure codes returned in the
 * `{ok: false, error: code}` branch of `ShareConstructUrlResponseSchema`.
 *
 * - `no-remote` — `.git/config` has no `[remote "origin"] url`. The sender
 *   should be routed through the Publish wizard.
 * - `detached-head` — `.git/HEAD` is not a symbolic ref. Sender must check
 *   out a branch before sharing (detached-head disabled state).
 * - `branch-not-on-origin` — current branch has no
 *   `.git/refs/remotes/origin/<branch>` (loose or packed). Sender must push
 *   the branch before sharing (by local-ref contract, this is checked locally — no
 *   `git ls-remote` is issued, so a stale local fetch may mis-fire as a
 *   false negative; the user re-pushes, no harm done).
 * - `non-github-remote` — origin URL parses but the host is not `github.com`
 *   (gitlab, bitbucket, internal forge). Share is GitHub-only in v1.
 * - `invalid-path` — the share target path (a doc's file path or a folder's
 *   directory path) traverses outside the project root or names the `.git/`
 *   subtree. An empty path is NOT invalid: it is a legitimate content-root
 *   folder share. The user-facing toast is generic.
 */
export const ShareConstructUrlErrorCodeSchema = z.enum([
  'no-remote',
  'detached-head',
  'branch-not-on-origin',
  'non-github-remote',
  'invalid-path',
]) satisfies StandardSchemaV1;
export type ShareConstructUrlErrorCode = z.infer<typeof ShareConstructUrlErrorCodeSchema>;

/**
 * Success body for `POST /api/share/construct-url`, discriminated on `ok`.
 *
 * Happy path carries the encoded marketing URL (`shareUrl`), the unencoded
 * GitHub URL (`sharedUrl`) — a blob URL for a doc, a tree URL for a folder —
 * so callers can fall back to the splash custom-scheme handoff form without
 * re-encoding, and the resolved branch name (so
 * the toast can name it on `branch-not-on-origin` retries).
 *
 * Schemas are `.loose()` per the file-wide convention for forward-compat;
 * adding fields (e.g., `defaultBranch` for splash branch-indicator hints)
 * stays a non-breaking change.
 */
export const ShareConstructUrlResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      shareUrl: z.string().min(1),
      sharedUrl: z.string().min(1),
      branch: z.string().min(1),
    })
    .loose(),
  z
    .object({
      ok: z.literal(false),
      error: ShareConstructUrlErrorCodeSchema,
      // Populated for `branch-not-on-origin` so the editor's toast can name
      // the offending branch verbatim ("Push <branch> to GitHub before
      // sharing."). Other error variants omit it; consumers must treat it
      // as optional. Additive optional field — older clients ignore it.
      branch: z.string().min(1).optional(),
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type ShareConstructUrlResponse = z.infer<typeof ShareConstructUrlResponseSchema>;

// ─── Publish-to-GitHub wizard ────────────────────────────────────────

/**
 * One eligible owner returned by `GET /api/share/publish/owners`.
 * The authenticated user is always first (`kind: 'user'`); the rest are
 * organizations the user is an active member of where
 * `permissions.can_create_repository === true` (owner pre-filter).
 */
export const SharePublishOwnerKindSchema = z.enum(['user', 'org']) satisfies StandardSchemaV1;
export type SharePublishOwnerKind = z.infer<typeof SharePublishOwnerKindSchema>;

export const SharePublishOwnerSchema = z
  .object({
    login: z.string().min(1),
    kind: SharePublishOwnerKindSchema,
    avatarUrl: z.string().optional(),
  })
  .loose() satisfies StandardSchemaV1;
export type SharePublishOwner = z.infer<typeof SharePublishOwnerSchema>;

/**
 * Shared error code enum for both `owners` and `name-check` — the two GET-
 * style probes share a single failure surface: either we have a valid
 * token (proceed) or we don't (auth-required), or the GitHub API itself
 * misbehaves (network). v1 does NOT differentiate rate-limit from generic
 * network errors; the wizard banner is the same.
 */
export const SharePublishOwnersErrorCodeSchema = z.enum([
  'auth-required',
  'network',
]) satisfies StandardSchemaV1;
export type SharePublishOwnersErrorCode = z.infer<typeof SharePublishOwnersErrorCodeSchema>;

/**
 * Response body for `GET /api/share/publish/owners`. Schemas are `.loose()`
 * per file convention so adding fields (e.g., per-org repo-creation policy
 * details) stays additive.
 */
export const SharePublishOwnersResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      owners: z.array(SharePublishOwnerSchema),
    })
    .loose(),
  z
    .object({
      ok: z.literal(false),
      error: SharePublishOwnersErrorCodeSchema,
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type SharePublishOwnersResponse = z.infer<typeof SharePublishOwnersResponseSchema>;

/**
 * Response body for `GET /api/share/publish/name-check?owner=<o>&name=<n>`.
 * The path is GET-style with query params, so there is no separate request
 * schema — the server validates `owner` + `name` are non-empty strings
 * before spawning the CLI subprocess.
 */
export const SharePublishNameCheckResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      available: z.boolean(),
    })
    .loose(),
  z
    .object({
      ok: z.literal(false),
      error: SharePublishOwnersErrorCodeSchema,
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type SharePublishNameCheckResponse = z.infer<typeof SharePublishNameCheckResponseSchema>;

/**
 * Request body for `POST /api/share/publish`.
 *
 * - `owner` is one of the `login` values returned by the owners endpoint.
 * - `name` is the sanitized basename suggested by the wizard; the server
 *   re-validates that the name only contains [A-Za-z0-9._-] characters.
 * - `visibility` defaults to private.
 * - `description` is optional and seeded from `.ok/config.yml` title.
 */
export const SharePublishVisibilitySchema = z.enum([
  'public',
  'private',
]) satisfies StandardSchemaV1;
export type SharePublishVisibility = z.infer<typeof SharePublishVisibilitySchema>;

export const SharePublishRequestSchema = z
  .object({
    owner: z.string().min(1),
    name: z.string().min(1),
    visibility: SharePublishVisibilitySchema,
    description: z.string().optional(),
  })
  .loose() satisfies StandardSchemaV1;
export type SharePublishRequest = z.infer<typeof SharePublishRequestSchema>;

/**
 * Closed enum of publish-flow failure codes returned in
 * `{ok: false, error: code}`. The wizard maps each to its banner:
 *
 * - `name-conflict` — `<owner>/<name>` already exists; reopen the form
 *   with the Name field focused.
 * - `saml-sso` — GitHub denied with a SAML/SSO marker; banner is the
 *   generic "Authorize OpenKnowledge for <org>" path.
 * - `auth-required` — Token is missing/invalid; bounce through the
 *   existing Device Flow modal.
 * - `push-failed` — Repo was created but the initial push failed;
 *   wizard shows a "Retry push" affordance.
 * - `init-failed` — Local filesystem precondition broke (couldn't
 *   scaffold `.ok/` or `git init`). Rare.
 * - `network` — Catch-all for GitHub transport / 5xx / unexpected.
 * - `no-project` — Server's `projectDir` is unset; the caller is
 *   running outside a real project.
 */
export const SharePublishErrorCodeSchema = z.enum([
  'name-conflict',
  'saml-sso',
  'auth-required',
  'push-failed',
  'init-failed',
  'network',
  'no-project',
]) satisfies StandardSchemaV1;
export type SharePublishErrorCode = z.infer<typeof SharePublishErrorCodeSchema>;

/**
 * Response body for `POST /api/share/publish`. Happy path carries the
 * fields the wizard needs to construct + copy the share URL via the
 * existing `POST /api/share/construct-url` endpoint without a second
 * round-trip to git state.
 */
export const SharePublishResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      ownerLogin: z.string().min(1),
      repoName: z.string().min(1),
      cloneUrl: z.string().min(1),
      defaultBranch: z.string().min(1),
    })
    .loose(),
  z
    .object({
      ok: z.literal(false),
      error: SharePublishErrorCodeSchema,
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type SharePublishResponse = z.infer<typeof SharePublishResponseSchema>;

// ─── Shared branch-name validator ─────────────────────────────────────

/**
 * Single source of truth for "is this string safe to interpolate into a git
 * ref / refspec / `<ref>:<path>` argument". Consumed by:
 *   - server-side handlers (`git-branch-info.ts` re-exports as a predicate)
 *   - `CheckoutRequestSchema` (this file)
 *   - `LocalOpCloneRequestSchema` (`_envelope.ts`)
 *
 * Rejects:
 *   - non-string / empty
 *   - leading `-` (git CLI flag injection, e.g. `--upload-pack=evil`)
 *   - control chars (`\x00`-`\x1F`, `\x7F`)
 *   - whitespace anywhere (space, tab, newline)
 *   - `..` as a slash-separated segment (path traversal in `<ref>:<path>`)
 *   - `:` (the refspec separator — `git fetch origin HEAD:refs/heads/evil`
 *     would otherwise rewrite local refs from attacker-controlled share URLs)
 *
 * Slashes are allowed — `feat/foo` is the canonical form for namespaced
 * branches.
 *
 * Scope note: git's full `git-check-ref-format`(1) ruleset is broader
 * (rejects `?`, `*`, `[`, `~`, `^`, `\`, etc.). The 7 rules here are the
 * named threats; expanding to the full ref-format spec is a separate
 * concern.
 */
export function isValidBranchName(branch: unknown): branch is string {
  if (typeof branch !== 'string') return false;
  if (branch.length === 0) return false;
  if (branch.startsWith('-')) return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control chars are exactly what we want to reject
  if (/[\x00-\x1F\x7F]/.test(branch)) return false;
  if (/\s/.test(branch)) return false;
  if (branch.includes(':')) return false;
  if (branch.split('/').includes('..')) return false;
  return true;
}

/**
 * Zod `.refine()` chain wrapper for `isValidBranchName` — shared across
 * `CheckoutRequestSchema` and `LocalOpCloneRequestSchema` so the seven-rule
 * contract has exactly one home. Returns a single message ("invalid branch
 * name") rather than per-rule messages; the wire envelope conveys the
 * structured `urn:ok:error:invalid-request` so per-rule strings are not
 * load-bearing.
 */
const refineBranchName = <T extends z.ZodString>(schema: T) =>
  schema.refine(isValidBranchName, 'invalid branch name');

/**
 * Single source of truth for "is this error a git CLI / simple-git failure
 * indicating that the requested branch does not exist on the remote".
 *
 * Consumed by:
 *   - `packages/cli/src/commands/clone.ts` `isBranchNotFoundError`
 *     (`git clone -b <branch>` failure → fallback to default branch)
 *   - `packages/server/src/git-checkout.ts` `isBranchNotFoundFetchError`
 *     (`git fetch origin <branch>` failure → discriminate `branch-not-found`
 *     from `fetch-failed`)
 *
 * Discriminator: git CLI emits one of
 *   - `fatal: couldn't find remote ref <ref>`
 *   - `fatal: Couldn't find remote ref <ref>` (capitalization varies by version)
 *   - `Remote branch <name> not found in upstream origin` (older formats)
 *
 * Anything else (network unreachable, auth denied, partial-fetch interrupted,
 * git binary missing) is treated as a non-branch-not-found failure.
 *
 * The English-text match is locale-fragile by design; server-side callers
 * pin `LANG=C`/`LC_ALL=C` via `createGitInstance`, and the cli wraps git via
 * `simple-git` whose default env passes through the shell locale — keep both
 * sites English-anchored.
 */
export function isBranchNotFoundGitError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /couldn'?t find remote ref|Remote branch .+ not found/i.test(message);
}

// ─── Git auth failure classifier ──────────────────────────────────────

/**
 * Subclasses of a git auth failure. The shape mirrors the auth branch of
 * `packages/server/src/error-classification.ts` `classifyGitError` — both
 * sites delegate to the regex banks below so the CLI's `ok clone` catch
 * and the server's sync error path stay in lock-step.
 *
 * - `no-credential` — git's credential helper returned nothing and stdin had
 *   no TTY, so the credential prompt was refused. The most common logged-out
 *   case on `ok clone` (we set `GIT_TERMINAL_PROMPT=0`).
 * - `401` — explicit HTTP 401 OR an "expired token" wording. The declared
 *   `expired-token` subclass folds into this; the classifier never emits it
 *   separately (mirrors the server's behavior).
 * - `403` — explicit HTTP 403. The recipient is authenticated but lacks
 *   access; re-login mints the same credentials.
 * - `scope-mismatch` — token missing required OAuth scopes. The device flow
 *   mints a fixed scope set, so re-login can't fix it.
 * - `ssh-auth` — SSH transport auth failure (publickey denied, host-key
 *   verification). `ok auth login` mints an HTTPS OAuth credential and cannot
 *   fix SSH keys or host-key trust, so this is NOT login-fixable.
 * - `unknown-auth` — generic HTTPS auth wording (authentication/authorization
 *   failed, bad credentials, private-repo "repository not found") without a
 *   401/403 signal; re-auth can mint working credentials (login-fixable).
 */
export type GitAuthFailureSubclass =
  | 'no-credential'
  | '401'
  | '403'
  | 'scope-mismatch'
  | 'ssh-auth'
  | 'unknown-auth';

/**
 * Discriminated result from {@link classifyGitAuthError}. `non-auth` is the
 * fall-through for non-auth git errors (network, branch-not-found, etc.) —
 * callers MUST not treat it as success.
 */
export type ClassifiedGitAuthError =
  | { kind: 'auth'; subclass: GitAuthFailureSubclass }
  | { kind: 'non-auth' };

const GIT_AUTH_NO_CREDENTIAL_PATTERNS: RegExp[] = [
  /could not read (username|password)/i,
  /terminal prompts disabled/i,
];

const GIT_AUTH_SCOPE_MISMATCH_PATTERNS: RegExp[] = [
  /insufficient scopes/i,
  /missing.*scope/i,
  /required scope/i,
];

/**
 * SSH transport auth failures. Split into their own bank (checked before the
 * general bank) so they classify as `ssh-auth` rather than `unknown-auth` —
 * `ok auth login` mints an HTTPS credential and cannot fix SSH keys or
 * host-key trust, so these must not be routed to the login recovery.
 */
const GIT_AUTH_SSH_PATTERNS: RegExp[] = [
  /permission denied.*\(publickey\)/i,
  /host key verification failed/i,
];

const GIT_AUTH_GENERAL_PATTERNS: RegExp[] = [
  /\b(401|403)\b/,
  /authentication failed/i,
  /authorization failed/i,
  /invalid credentials/i,
  /credential helper/i,
  /bad credentials/i,
  /token.*expired/i,
  /expired.*token/i,
  /fatal:.*repository.*not found/i,
];

function gitAuthExtractStderr(error: unknown): string {
  if (error === null || typeof error !== 'object') return '';
  const git = (error as { git?: unknown }).git;
  return git == null ? '' : String(git);
}

/**
 * Focused git-auth classifier shared by the CLI `ok clone` catch site and the
 * server's `classifyGitError` auth branch. Single source of truth for the
 * regex bank so the two sites cannot drift.
 *
 * Matches against `error.message` and any `simple-git`-style `error.git`
 * stderr text. Returns `{kind:'non-auth'}` for non-auth failures; callers fall
 * through to their existing non-auth handling.
 */
export function classifyGitAuthError(error: unknown): ClassifiedGitAuthError {
  if (error === null || error === undefined) return { kind: 'non-auth' };
  const message = error instanceof Error ? error.message : String(error);
  const combined = `${message}\n${gitAuthExtractStderr(error)}`;

  if (GIT_AUTH_NO_CREDENTIAL_PATTERNS.some((re) => re.test(combined))) {
    return { kind: 'auth', subclass: 'no-credential' };
  }
  if (GIT_AUTH_SCOPE_MISMATCH_PATTERNS.some((re) => re.test(combined))) {
    return { kind: 'auth', subclass: 'scope-mismatch' };
  }
  // SSH transport auth — matched BEFORE the general bank so publickey / host-key
  // failures classify as `ssh-auth` (not login-fixable) rather than unknown-auth.
  if (GIT_AUTH_SSH_PATTERNS.some((re) => re.test(combined))) {
    return { kind: 'auth', subclass: 'ssh-auth' };
  }
  if (GIT_AUTH_GENERAL_PATTERNS.some((re) => re.test(combined))) {
    if (/\b401\b/.test(combined) || /token.*expired/i.test(combined)) {
      return { kind: 'auth', subclass: '401' };
    }
    if (/\b403\b/.test(combined)) {
      return { kind: 'auth', subclass: '403' };
    }
    return { kind: 'auth', subclass: 'unknown-auth' };
  }
  return { kind: 'non-auth' };
}

/**
 * Login-fixable predicate: returns true iff re-running `ok auth login` could
 * plausibly resolve the failure. `403` is excluded because re-login doesn't
 * grant new access; `scope-mismatch` is excluded because the device flow
 * mints the same fixed scopes each time; `ssh-auth` is excluded because
 * `ok auth login` mints an HTTPS OAuth credential, not an SSH key.
 */
export function isLoginFixableGitAuthError(classified: ClassifiedGitAuthError): boolean {
  if (classified.kind !== 'auth') return false;
  return (
    classified.subclass === 'no-credential' ||
    classified.subclass === '401' ||
    classified.subclass === 'unknown-auth'
  );
}

// ─── Branch-info (share-link branch-awareness) ────────────────────────

/**
 * Response body for `GET /api/git/branch-info?branch=<targetBranch>&path=<path>`.
 *
 * Batches four independent reads against the local working tree in a single
 * round-trip so the receiver's branch-switch dialog can render all inputs
 * without flicker. All fields are derived from git operations that touch
 * only local refs/objects — no fetch, no `git ls-remote`.
 *
 * Discriminated on `detached` so contradictory states ({detached: true,
 * currentBranch: 'main'} / {detached: false, currentHeadSha: 'abc1234'})
 * are unrepresentable at the type level:
 *
 * - `{detached: false}` — HEAD is on a named branch. `currentBranch` carries
 *   the branch name; `currentHeadSha` is null.
 * - `{detached: true}` — HEAD is at a raw SHA. `currentHeadSha` carries the
 *   7-char short SHA; `currentBranch` is null.
 *
 * Shared fields (both variants):
 * - `shareTargetExists` — true iff `git cat-file -e <ref>:<path>` succeeds,
 *   where `ref` is the current branch name or `HEAD` (detached).
 * - `dirtyConflicts` — `dirtyFilesOverlapWith(projectDir, targetBranch)`.
 *   `files` is the intersection of dirty working-tree paths and paths that
 *   would change when switching to `targetBranch`. Empty when no overlap.
 * - `branchIsLocal` — true iff `refs/heads/<targetBranch>` resolves locally
 *   (no fetch attempted). Drives whether the checkout endpoint must fetch.
 */
const BranchInfoSharedFields = {
  shareTargetExists: z.boolean(),
  dirtyConflicts: z
    .object({
      conflicts: z.boolean(),
      files: z.array(z.string().min(1)),
    })
    .loose(),
  branchIsLocal: z.boolean(),
};

export const BranchInfoResponseSchema = z.discriminatedUnion('detached', [
  z
    .object({
      detached: z.literal(false),
      currentBranch: z.string().min(1).nullable(),
      currentHeadSha: z.null(),
      ...BranchInfoSharedFields,
    })
    .loose(),
  z
    .object({
      detached: z.literal(true),
      currentBranch: z.null(),
      currentHeadSha: z.string().min(1),
      ...BranchInfoSharedFields,
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type BranchInfoResponse = z.infer<typeof BranchInfoResponseSchema>;

// ─── Checkout (share-link branch-awareness) ───────────────────────────

/**
 * Request body for `POST /api/git/checkout`.
 *
 * `branch` is validated via the shared `isValidBranchName` predicate above
 * (single source of truth for the seven-rule contract).
 *
 * Identity fields (`principalId`, `agentId`, etc.) are threaded through
 * `extractActorIdentity` for observability only — checkout is a git-level
 * operation with no CRDT mutation. The schema is `.loose()` so additional
 * identity fields parsed by `extractActorIdentity` (clientName, label, …)
 * are accepted without per-field declarations here.
 */
export const CheckoutRequestSchema = z
  .object({
    branch: refineBranchName(z.string().min(1)),
    principalId: z.string().optional(),
  })
  .loose() satisfies StandardSchemaV1;
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;

/**
 * Closed enum of business-logic failure codes returned in the
 * `{ok: false, reason: code}` branch of `CheckoutResponseSchema`.
 *
 * - `dirty-conflict` — working-tree dirty files overlap with the file set
 *   that would change when switching to the target branch. `files` carries
 *   the offending paths so the dialog can name them verbatim.
 * - `branch-not-found` — the branch is not present locally AND `git fetch
 *   origin <branch>` failed with "couldn't find remote ref" (or equivalent).
 *   Means the branch was deleted upstream.
 * - `fetch-failed` — `git fetch origin <branch>` failed for a non-branch-
 *   not-found reason (network, auth, transport). Distinct from
 *   `branch-not-found` so the dialog can offer "retry / check connection"
 *   copy. Discriminator is the simple-git stderr message — if the message
 *   doesn't match the known "couldn't find remote ref" patterns, the
 *   conservative default is `fetch-failed`.
 * - `checkout-failed` — `git checkout <branch>` itself failed for any
 *   reason after the precondition gates passed (e.g. concurrent index
 *   contention not caught by `withParentLock`).
 * - `branch-in-other-worktree` — git refused the checkout because the
 *   requested branch is already checked out at another linked worktree
 *   (`fatal: '<branch>' is already checked out at '<path>'`). Distinct
 *   from `checkout-failed` so the dialog can offer "Open that worktree
 *   instead" instead of the generic "try switching manually" copy. The
 *   accompanying `otherWorktreePath` carries the realpath-collapsed path
 *   git reported.
 */
export const CheckoutFailureReasonSchema = z.enum([
  'dirty-conflict',
  'branch-not-found',
  'fetch-failed',
  'checkout-failed',
  'branch-in-other-worktree',
]) satisfies StandardSchemaV1;
export type CheckoutFailureReason = z.infer<typeof CheckoutFailureReasonSchema>;

/**
 * Response body for `POST /api/git/checkout`, discriminated on `ok`.
 *
 * Both branches return HTTP 200; protocol-level errors (400 malformed
 * body, 500 unexpected) use the standard RFC 9457 problem+json envelope
 * via `errorResponse`. Logical failures carry the discriminated reason
 * code so the dialog can map each to its own toast copy.
 *
 * On `dirty-conflict`, `files` is the same intersection-of-paths set
 * `dirtyFilesOverlapWith` returns — sorted ascending, deduped. Omitted
 * on all other failure variants and on success.
 */
export const CheckoutResponseSchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
    })
    .loose(),
  z
    .object({
      ok: z.literal(false),
      reason: CheckoutFailureReasonSchema,
      files: z.array(z.string().min(1)).optional(),
      /**
       * Realpath-collapsed worktree path that already has the requested
       * branch checked out. Present iff `reason === 'branch-in-other-worktree'`
       * — the dialog renders an "Open that worktree instead" CTA pointing
       * at this path. Optional on the schema so the existing failure
       * variants don't need to carry it; the handler emits it only when
       * the stderr classifier extracts one.
       */
      otherWorktreePath: z.string().min(1).optional(),
    })
    .loose(),
]) satisfies StandardSchemaV1;
export type CheckoutResponse = z.infer<typeof CheckoutResponseSchema>;
