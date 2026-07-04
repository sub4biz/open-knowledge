/**
 * Server-side bridge invariant watchdog.
 *
 * Y.Text-is-truth contract assertion site: after Observer B Phase 1 derives
 * fragment from `parse(ytext)`, the watchdog asserts that the post-write
 * bridge invariant holds:
 *
 *   normalizeBridge(ytext.toString())
 *     === normalizeBridge(prependFrontmatter(fm, mdManager.serialize(fragment)))
 *
 * Outside the `normalizeBridge` tolerance set, the watchdog fires:
 *   - dev (`NODE_ENV=test` or `OK_BRIDGE_THROW_ON_VIOLATION=1`):
 *     throws `BridgeInvariantViolationError` so integration tests + fuzz
 *     runs surface the regression loudly.
 *   - prod: emits a structured `bridge-invariant-violation` console.warn
 *     event (machine-readable JSON) + increments
 *     `bridgeInvariantViolations`. Rate-limited per (site, doc) tuple so
 *     a single buggy doc cannot drown the signal.
 *
 * Lives in its own module because precedent #13(b) bans wall-clock
 * SCHEDULING (`setTimeout`, `setInterval`) in `server-observers.ts` —
 * see `bridge-no-wallclock.test.ts` for the enforced gate's `FORBIDDEN`
 * regex array. The rate-limiter needs `Date.now()` for window comparison;
 * co-locating it here keeps timer machinery isolated even though the
 * precedent gate doesn't cover `Date.now()` directly (server-observers.ts
 * itself uses `new Date().toISOString()` for the timestamp field of its
 * own structured-log events).
 *
 * Telemetry payload is bounded-cardinality and content-redacted by default:
 * site, docName-or-null, the tolerance-class label (`'untracked'` for
 * unknown classes — the comparator tolerates known classes, so a violation
 * outside tolerance is by definition untracked), and FNV-1a digests of the
 * ytext + fragment snapshots for cross-event correlation. The truncated
 * unifiedDiff is included as `diff` ONLY when `OK_TELEMETRY_VERBOSE=1`
 * (mirrors the sibling `bridge-merge-content-loss` opt-in pattern). Full
 * snapshots travel only on the thrown error for dev triage; never logged.
 *
 * @see packages/core/src/bridge/normalize.ts (tolerance set)
 * @see packages/core/src/bridge/bridge-invariant.ts (error type)
 */

import {
  type BridgeInvariantSite,
  type BridgeInvariantViolation,
  BridgeInvariantViolationError,
  type BridgeToleranceClass,
  detectAppliedToleranceClasses,
  emitToleranceFire,
  normalizeBridge,
  toBridgeInvariantLog,
} from '@inkeep/open-knowledge-core';
import {
  incrementBridgeInvariantViolations,
  incrementBridgeInvariantViolationsSuppressed,
  incrementBridgeSplitBrainRederivesSuppressed,
  incrementBridgeToleranceApplied,
  incrementObserverAPathBFiresSuppressed,
} from './metrics.ts';

// ─────────────────────────────────────────────────────────────
// Rate-limiter
// ─────────────────────────────────────────────────────────────

/**
 * Default debounce window (seconds) per (doc, site) tuple. After the first
 * emission within a window, additional violations bump the suppressed
 * counter without producing further structured-log events. The window
 * resets on the next emission past the deadline.
 *
 * Configurable via `OK_BRIDGE_VIOLATION_DEBOUNCE_S` env var (positive integer
 * seconds; falls back to default on unparseable values per `readDebounceMs`
 * below).
 */
const DEFAULT_DEBOUNCE_S = 60;

/** Map<rateKey, last-emit-Unix-ms>. rateKey = `${site}::${docName ?? '__nodoc__'}`.
 *  Bounded by lazy pruning (see `MAX_VIOLATION_RATE_TUPLES`) — without it the
 *  map would grow indefinitely as docs are renamed/deleted/created over a
 *  long-lived server: every (site, docName) tuple that ever emitted a
 *  violation leaves a permanent entry. The leak only manifests in pathological
 *  cases (the exact regime the watchdog targets), so growth must be bounded
 *  even though steady-state target is ~0 violations.
 *
 *  WARN: module-level state. Today this is correct because exactly one server
 *  runs per `contentDir` per process (enforced by `server.lock`). If multi-
 *  server-per-process is ever adopted (multi-vault desktop, cloud multi-
 *  tenant), this map would conflate (site, docName) tuples across servers —
 *  Server A's violation rate-limit window would suppress Server B's
 *  violation event for the same docName within the same window, degrading
 *  the per-tenant signal. The fix at that point is closure-scoping per
 *  server (compare `persistence.ts:configLkgCache`), threading the cache
 *  through `assertBridgeInvariant` instead of capturing it at module scope.
 *  Tracking here so the future-fix is discoverable. */
const lastEmitMs = new Map<string, number>();

/** Lazy-pruning threshold for `lastEmitMs`. When the map exceeds this, the
 *  next `shouldEmitBridgeInvariantViolation` walks past-window entries
 *  (older than `debounceMs`) and deletes them — those entries already permit
 *  emission so dropping them is functionally identical to keeping them.
 *
 *  Conditional bound: pruning reclaims keys whose last-emit is past the
 *  debounce window. Under a truly sustained burst (>1024 distinct (site, doc)
 *  tuples ALL emitting within the same window), every entry is within-window,
 *  the prune walk deletes nothing, and the map continues to grow until the
 *  burst cools. Acceptable because (a) repeat violations on the same key do
 *  NOT add new entries (rate-limiter overwrites), so pathological growth
 *  requires N distinct doc names violating concurrently within one window —
 *  rare in practice; (b) once any subset cools below the window, the next
 *  emission reclaims them. 1024 keeps the audit signal (recent doc names
 *  emitting violations) intact across short wall windows. */
const MAX_VIOLATION_RATE_TUPLES = 1024;

/** Map<rateKey, last-emit-Unix-ms> for the bridge-tolerance-applied event.
 *  rateKey = `${site}::${class}`. Bounded cardinality: 16 classes × 3 sites =
 *  48 entries max globally. Per-(site, class) windows let operators see how
 *  often each site relies on each tolerance class — observer-b CRLF rates
 *  vs persistence CRLF rates surface separately.
 *
 *  WARN: same module-level state caveat as `lastEmitMs` above. The 48-entry
 *  bound is global; under multi-server-per-process, a single server's
 *  tolerance event would suppress another server's same-class event in
 *  the same window. Less concerning than the violation rate-limiter
 *  because tolerance events are informational (they're documented
 *  tolerated bytes), not signals of regression. */
const lastToleranceEmitMs = new Map<string, number>();

/** Map<docName, last-emit-Unix-ms> for the observer-a-path-b-fired event.
 *  Per-doc keying so a single chatty doc cannot suppress events from other
 *  docs. The counter (`observerAPathBFires`) increments only on emit,
 *  matching the bridge-invariant-violation pattern; the suppressed counter
 *  is bumped when this gate closes. Each Path B fire bumps exactly one of
 *  the two, so the documented identity `actual_rate = fires + suppressed`
 *  holds. Sentinel `__nodoc__` covers the rare path where a Y.Doc has no
 *  docName attribution.
 *
 *  WARN: same module-level state caveat as `lastEmitMs` above. */
const lastPathBEmitMs = new Map<string, number>();

/** Observer A settlement-check site that detected a drain settling
 *  split-brain. Three production sites in `server-observers.ts`: the
 *  identity gate (fragment changed but its serialization didn't move),
 *  the post-merge baseline check (after a Path A/B Y.Text write), and
 *  the error-recovery catch (sync work threw before the settlement check,
 *  so the baseline reset must not witness a divergent Y.Text). */
export type BridgeSplitBrainSite = 'identity-gate' | 'post-merge' | 'error-recovery';

/** Map<rateKey, last-emit-Unix-ms> for the bridge-split-brain-rederive
 *  event. rateKey = `${site}::${docName ?? '__nodoc__'}` — per-(site, doc)
 *  so a chatty doc can't suppress signal from quieter docs and the two
 *  detection sites surface independently. Bounded: 2 sites × docs, with
 *  the same lazy prune as `lastEmitMs`.
 *
 *  WARN: same module-level state caveat as `lastEmitMs` above. */
const lastSplitBrainEmitMs = new Map<string, number>();

function toleranceRateKey(site: BridgeInvariantSite, cls: BridgeToleranceClass): string {
  return `${site}::${cls}`;
}

/**
 * Read & validate the configured debounce in seconds; default 60.
 *
 * Read per-call (not cached at module init) so an operator can adjust the
 * window mid-process for debugging — set `OK_BRIDGE_VIOLATION_DEBOUNCE_S=5`
 * via the running server's environment to narrow the window without
 * restart. The lazy-prune walk in `shouldEmitBridgeInvariantViolation`
 * snapshots `debounceMs` at call time, so a window change propagates
 * immediately: entries past the new (narrower) window get reclaimed; entries
 * within get kept. The capacity bound (`MAX_VIOLATION_RATE_TUPLES = 1024`)
 * is orthogonal to the time-window — it caps map growth regardless of
 * debounce setting.
 *
 * The per-call cost is a single `process.env` lookup + integer parse —
 * negligible compared to the surrounding `normalizeBridge` call (already
 * O(N) in document size).
 */
function readDebounceMs(): number {
  const raw = process.env.OK_BRIDGE_VIOLATION_DEBOUNCE_S;
  if (raw === undefined) return DEFAULT_DEBOUNCE_S * 1000;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DEBOUNCE_S * 1000;
  return parsed * 1000;
}

/** rateKey scopes the debounce to (site, docName). */
function rateKey(site: BridgeInvariantSite, docName: string | undefined): string {
  return `${site}::${docName ?? '__nodoc__'}`;
}

/**
 * Gate: returns `true` if the caller should emit a structured-log event for
 * this (site, doc) tuple right now. Returns `false` if the previous emission
 * is still within the debounce window — caller should bump the suppressed
 * counter instead.
 *
 * Test seam: pass `nowMs` to deterministically advance the clock. Production
 * path uses `Date.now()` (default arg).
 */
export function shouldEmitBridgeInvariantViolation(
  site: BridgeInvariantSite,
  docName: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  const key = rateKey(site, docName);
  const last = lastEmitMs.get(key);
  const debounceMs = readDebounceMs();
  if (last !== undefined && nowMs - last < debounceMs) return false;
  // Lazy prune past-window entries before inserting. Past-window entries
  // would gate-permit emission on next access anyway, so dropping them is
  // semantically equivalent. Bounded growth: only fires when the map
  // exceeds MAX_VIOLATION_RATE_TUPLES, so steady-state cost is zero.
  if (lastEmitMs.size >= MAX_VIOLATION_RATE_TUPLES) {
    for (const [k, lastMs] of lastEmitMs) {
      if (nowMs - lastMs >= debounceMs) lastEmitMs.delete(k);
    }
  }
  lastEmitMs.set(key, nowMs);
  return true;
}

/**
 * Gate: returns `true` if the caller should emit a bridge-tolerance-applied
 * event for this (site, class) tuple right now. Returns `false` if the
 * previous emission for the same tuple is still within the debounce window.
 *
 * Keying by (site, class) — not just class — so observer-b's CRLF reliance
 * doesn't suppress persistence-site CRLF reliance within the same window.
 * Bounded: 16 classes × 3 sites = 48 entries.
 *
 * Test seam: pass `nowMs` to deterministically advance the clock.
 */
export function shouldEmitBridgeToleranceApplied(
  site: BridgeInvariantSite,
  toleranceClass: BridgeToleranceClass,
  nowMs: number = Date.now(),
): boolean {
  const key = toleranceRateKey(site, toleranceClass);
  const last = lastToleranceEmitMs.get(key);
  const debounceMs = readDebounceMs();
  if (last !== undefined && nowMs - last < debounceMs) return false;
  lastToleranceEmitMs.set(key, nowMs);
  return true;
}

/**
 * Gate: returns `true` if the caller should emit an `observer-a-path-b-fired`
 * structured-log event for this doc right now. Returns `false` if the previous
 * emission for the same doc is still within the debounce window. The caller
 * increments `observerAPathBFires` only on emit (i.e., when the gate returns
 * true), and `observerAPathBFiresSuppressed` is bumped here when the gate
 * closes. Each Path B fire bumps exactly one of the two counters, so the
 * documented identity `actual_rate = fires + suppressed` holds.
 *
 * Path B fires once per drain when ytext has diverged from the
 * lastSyncedYTextBytes raw witness (slow path). Under multi-peer concurrent editing or a degenerate
 * baseline-staleness loop, this can fire multiple times per second. Without
 * a rate-limiter, the `console.warn` flood drowns the very signal operators
 * need ("the slow path is hot"). Rate-limiting brings this event in line
 * with `bridge-invariant-violation` and `bridge-tolerance-applied` — every
 * structured-log event in the watchdog stack now uses the same debounce
 * primitive.
 *
 * Per-doc key (sentinel `__nodoc__` for unattributed paths) so a chatty doc
 * doesn't suppress signal from quieter docs.
 *
 * Test seam: pass `nowMs` to deterministically advance the clock.
 */
export function shouldEmitObserverAPathBFired(
  docName: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  const key = docName ?? '__nodoc__';
  const last = lastPathBEmitMs.get(key);
  const debounceMs = readDebounceMs();
  if (last !== undefined && nowMs - last < debounceMs) return false;
  // Bound map growth lazily, mirroring `shouldEmitBridgeInvariantViolation`.
  if (lastPathBEmitMs.size >= MAX_VIOLATION_RATE_TUPLES) {
    for (const [k, lastMs] of lastPathBEmitMs) {
      if (nowMs - lastMs >= debounceMs) lastPathBEmitMs.delete(k);
    }
  }
  lastPathBEmitMs.set(key, nowMs);
  return true;
}

/**
 * Account for an Observer A Path B emission — wrapper around the rate gate
 * that also bumps the suppressed counter so callers don't have to thread
 * both primitives. Returns `true` when the caller should `console.warn`
 * the structured event; `false` when suppressed (counter already bumped).
 *
 * Pattern matches the in-line "shouldEmit + suppressed counter bump" used
 * by `assertBridgeInvariant` for `bridge-invariant-violation`.
 */
export function emitObserverAPathBFired(docName: string | undefined, nowMs?: number): boolean {
  const shouldEmit = shouldEmitObserverAPathBFired(docName, nowMs);
  if (!shouldEmit) {
    incrementObserverAPathBFiresSuppressed();
  }
  return shouldEmit;
}

/**
 * Gate: returns `true` if the caller should emit a `bridge-split-brain-rederive`
 * structured-log event for this (site, doc) tuple right now. Returns `false`
 * if the previous emission for the same tuple is still within the debounce
 * window.
 *
 * On an irreducibly-divergent doc (a fallback whose PM content cannot
 * represent its source region), the split-brain settlement check fires on
 * every Observer A drain — every WYSIWYG keystroke — so without the gate the
 * event would drown the very drift signal it exists to surface.
 *
 * Test seam: pass `nowMs` to deterministically advance the clock.
 */
export function shouldEmitBridgeSplitBrainRederive(
  site: BridgeSplitBrainSite,
  docName: string | undefined,
  nowMs: number = Date.now(),
): boolean {
  const key = `${site}::${docName ?? '__nodoc__'}`;
  const last = lastSplitBrainEmitMs.get(key);
  const debounceMs = readDebounceMs();
  if (last !== undefined && nowMs - last < debounceMs) return false;
  // Bound map growth lazily, mirroring `shouldEmitBridgeInvariantViolation`.
  if (lastSplitBrainEmitMs.size >= MAX_VIOLATION_RATE_TUPLES) {
    for (const [k, lastMs] of lastSplitBrainEmitMs) {
      if (nowMs - lastMs >= debounceMs) lastSplitBrainEmitMs.delete(k);
    }
  }
  lastSplitBrainEmitMs.set(key, nowMs);
  return true;
}

/**
 * Account for a split-brain re-derive detection — wrapper around the rate
 * gate that also bumps the suppressed counter so callers don't have to
 * thread both primitives. Returns `true` when the caller should
 * `console.warn` the structured event; `false` when suppressed (counter
 * already bumped). Mirrors `emitObserverAPathBFired`.
 */
export function emitBridgeSplitBrainRederive(
  site: BridgeSplitBrainSite,
  docName: string | undefined,
  nowMs?: number,
): boolean {
  const shouldEmit = shouldEmitBridgeSplitBrainRederive(site, docName, nowMs);
  if (!shouldEmit) {
    incrementBridgeSplitBrainRederivesSuppressed();
  }
  return shouldEmit;
}

/**
 * Reset the rate-limiter window cache. Test-only — production code never
 * needs this because each unique (site, docName) tuple is keyed by the
 * doc lifetime and the cache grows lazily; in tests, multiple cases share
 * the same key space and need a clean slate per assertion.
 */
export function __resetBridgeWatchdogForTests(): void {
  lastEmitMs.clear();
  lastToleranceEmitMs.clear();
  lastPathBEmitMs.clear();
  lastSplitBrainEmitMs.clear();
}

/**
 * Read the current size of the violation rate-limiter cache. Test-only —
 * lets the prune-behaviour suite assert memory boundedness without
 * exposing the cache contents (which are bounded-cardinality but
 * irrelevant to the bound test). The two observable behaviours of the
 * lazy prune are: (1) below threshold the map grows linearly; (2) past
 * threshold + past-window keys are reclaimed. Both require reading size.
 */
export function __getViolationRateTupleCountForTests(): number {
  return lastEmitMs.size;
}

/**
 * Read the current size of the split-brain-rederive rate-limiter cache.
 * Test-only — lets the prune-behaviour suite assert memory boundedness
 * without exposing the cache contents (which are bounded-cardinality but
 * irrelevant to the bound test). The two observable behaviours of the
 * lazy prune are: (1) below threshold the map grows linearly; (2) past
 * threshold + past-window keys are reclaimed. Both require reading size.
 */
export function __getSplitBrainRateTupleCountForTests(): number {
  return lastSplitBrainEmitMs.size;
}

// ─────────────────────────────────────────────────────────────
// Throw vs. emit policy
// ─────────────────────────────────────────────────────────────

/**
 * Decide whether to throw `BridgeInvariantViolationError`. Affirmative gate
 * (NOT `!== 'production'`) — Bun leaves `NODE_ENV` undefined for `bun run`
 * and `open-knowledge start`; an inverted gate would re-throw in production.
 * Test runners (`bun test`) auto-populate `NODE_ENV=test`; integration
 * harnesses launched outside `bun test` opt in via
 * `OK_BRIDGE_THROW_ON_VIOLATION=1`.
 *
 * Mirrors the polarity rationale in
 * `server-observers.ts:shouldRethrowBridgeMergeLoss`.
 */
export function shouldThrowOnBridgeInvariantViolation(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.NODE_ENV === 'test' || env.OK_BRIDGE_THROW_ON_VIOLATION === '1';
}

// ─────────────────────────────────────────────────────────────
// Watchdog assertion
// ─────────────────────────────────────────────────────────────

interface AssertBridgeInvariantOpts {
  site: BridgeInvariantSite;
  /** Doc name for log attribution + rate-limiter scoping. */
  docName?: string;
  /**
   * The originating transaction's origin (or any identifier the caller
   * wants to attribute the violation to). Optional — afterAllTransactions
   * runs after the tx ends, so call sites firing from there pass `undefined`.
   */
  origin?: unknown;
  /** Test seam — pass a clock to make rate-limiter behaviour deterministic. */
  nowMs?: number;
  /**
   * Per-call-site throw-discipline opt-out. Observer B is the contract's
   * primary enforcer — by default the watchdog throws under
   * `shouldThrowOnBridgeInvariantViolation()` so regressions surface loudly
   * in the integration suite. The persistence site is downstream: it logs
   * telemetry, writes Y.Text bytes anyway, and queues a fragment
   * reconciliation. It MUST always proceed to write, including in test runs
   * that exercise transient divergence during recovery paths (provider-pool
   * reconnect, mid-rescue persistence fires, etc.).
   *
   * When `true`, the watchdog uses the production emit path (rate-limited
   * telemetry + counter; suppressed counter past the debounce window)
   * regardless of `shouldThrowOnBridgeInvariantViolation()`. Tests verify
   * persistence-site divergence detection via the metric counters, not via
   * thrown errors. Observer B still throws by default.
   */
  suppressDevThrow?: boolean;
}

/**
 * Compare ytext bytes to the canonical fragment-serialization view. If the
 * comparator (`normalizeBridge`) finds them equivalent, no-op. Otherwise:
 *   - dev/test: throw `BridgeInvariantViolationError` (loud failure).
 *   - prod: emit rate-limited structured-log event + increment counter
 *     (suppressed counter for events past the debounce window).
 *
 * Caller passes the right-hand-side already composed
 * (`prependFrontmatter(fm, mdManager.serialize(parsedJson))`). Computing it
 * here would force an extra `serialize(parse(...))` call; many sites already
 * have the value in scope.
 *
 * Returns `true` when `normalizeBridge` finds the inputs equivalent (the
 * happy path; tolerance-class differences are reported via the
 * `bridge-tolerance-applied` event but still return true). Returns `false`
 * when divergence is outside the tolerance set and the function does not
 * throw — either because `shouldThrowOnBridgeInvariantViolation()` returns
 * false (production) or because `suppressDevThrow: true` bypasses the
 * throw gate. In the non-throw case the function emits a
 * `bridge-invariant-violation` event, or — when rate-limited — increments
 * the suppressed counter only. The return value lets callers drop a
 * redundant `normalizeBridge` recomputation when they want to gate
 * follow-up work (e.g., queueing fragment reconciliation) on the same
 * comparison the watchdog already performed — and prevents accidental
 * divergence between the watchdog's comparison and the caller's gate.
 */
export function assertBridgeInvariant(
  ytextSnapshot: string,
  fragmentMdSnapshot: string,
  opts: AssertBridgeInvariantOpts,
): boolean {
  const ytextNorm = normalizeBridge(ytextSnapshot);
  const fragNorm = normalizeBridge(fragmentMdSnapshot);
  if (ytextNorm === fragNorm) {
    // Tolerance-applied path: bytes are normalize-equal but may differ
    // pre-normalization. Emit one bridge-tolerance-applied event per
    // detected (site, class) tuple so operators can prioritize closing
    // tolerance gaps per-site. Bounded cardinality: 16 classes × 3 sites
    // = 48 series globally; rate-limited per (site, class).
    if (ytextSnapshot !== fragmentMdSnapshot) {
      const classes = detectAppliedToleranceClasses(ytextSnapshot, fragmentMdSnapshot);
      // Two consumers, two policies. The metric counter + console.warn loop
      // are noise/cardinality controls, so they share ONE rate-limit decision
      // per (site, class). The JSONL file hook is evidence collection for the
      // aggregator CLI: it needs every fire to measure frequency, and the
      // RotatingAppender already bounds disk (~16MB across two generations),
      // so it intentionally gets the full un-rate-limited class list.
      const emittedClasses = classes.filter((cls) =>
        shouldEmitBridgeToleranceApplied(opts.site, cls, opts.nowMs),
      );
      if (classes.length > 0) {
        emitToleranceFire(classes, ytextSnapshot, fragmentMdSnapshot, opts.docName);
      }
      for (const cls of emittedClasses) {
        incrementBridgeToleranceApplied(cls);
        console.warn(
          JSON.stringify({
            event: 'bridge-tolerance-applied',
            site: opts.site,
            class: cls,
          }),
        );
      }
    }
    return true;
  }

  const violation: BridgeInvariantViolation = {
    site: opts.site,
    origin: opts.origin,
    docName: opts.docName,
    ytextSnapshot,
    fragmentMdSnapshot,
    unifiedDiff: `  ytext: ${ytextNorm.slice(0, 300)}\n  frag:  ${fragNorm.slice(0, 300)}`,
    stack: new Error().stack,
  };

  // Dev/test: throw before incrementing — the regression should fail the
  // test loudly, not increment a counter and proceed. Persistence opts out
  // via `suppressDevThrow: true` because the persistence contract mandates
  // that the disk write proceeds regardless of divergence; throwing would
  // block the write during recovery paths that exercise transient
  // divergence (provider-pool reconnect, mid-rescue persistence fires).
  if (shouldThrowOnBridgeInvariantViolation() && !opts.suppressDevThrow) {
    throw new BridgeInvariantViolationError(violation);
  }

  // Production: rate-limited structured-log event.
  const shouldEmit = shouldEmitBridgeInvariantViolation(opts.site, opts.docName, opts.nowMs);
  if (!shouldEmit) {
    incrementBridgeInvariantViolationsSuppressed();
    return false;
  }
  incrementBridgeInvariantViolations();
  // Default-redacted: `ytextHash`/`fragmentHash` (FNV-1a) replace raw `diff`
  // bytes so log aggregators with weaker data-handling posture than the
  // application store don't accumulate verbatim user content. Operators
  // running a single-tenant local deployment can opt in to the truncated
  // unified diff via `OK_TELEMETRY_VERBOSE=1` — same opt-in pattern as the
  // sibling `bridge-merge-content-loss` event. The watchdog's documented
  // tolerance-class field stays `untracked` (violation by definition is
  // outside the comparator's tolerated set) and structured for future
  // per-class diagnosis. The `tolerance-class-attempted: 'untracked'` field
  // is left in place so future per-class diagnosis (e.g., "ytext has a
  // `\\r` the comparator should have stripped" would be a comparator-bug
  // signal worth carrying) has a stable home.
  const verbose = process.env.OK_TELEMETRY_VERBOSE === '1';
  console.warn(JSON.stringify(toBridgeInvariantLog(violation, { verbose })));
  return false;
}
