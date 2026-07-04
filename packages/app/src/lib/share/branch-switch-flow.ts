/**
 * Pure helpers for the share-receive branch-switch dialog variant.
 *
 * Inputs:
 *   - `BranchInfoResponse` from `GET /api/git/branch-info` — the receiver's
 *     current branch, whether the shared file exists at that ref, and the
 *     subset of dirty working-tree files that would conflict with a switch
 *     to the share's branch.
 *   - `CheckoutResponse` from `POST /api/git/checkout` — outcome of the
 *     server-side checkout call once the user clicks "Switch".
 *
 * The state-matrix logic lives here so it's testable without mounting a
 * React tree. The dialog component renders the variant returned by
 * `selectBranchSwitchVariant` and dispatches on the action returned by
 * `classifyCheckoutOutcome`.
 *
 * The dialog MUST NOT navigate when checkout returns `{ok: true}` — navigation
 * waits on the CC1 `branch-switched` signal so the CRDT transition is fully
 * settled before the doc opens. `classifyCheckoutOutcome` returns
 * `'await-cc1'` for this case; the listener registration is owned by a
 * follow-up story.
 */

import type { BranchInfoResponse, CheckoutResponse } from '@inkeep/open-knowledge-core';

/**
 * Discriminated outcome of `selectBranchSwitchVariant` — the four cells of
 * the state matrix the share-receive branch-switch dialog renders.
 *
 * - `A` — share file exists on current branch, working tree clean. Both
 *   "Open on current" and "Switch" are viable.
 * - `B` — share file missing on current branch, working tree clean. Only
 *   "Switch" is viable.
 * - `C` — share file exists on current branch, dirty conflict. "Open on
 *   current" remains viable; "Switch" is disabled with the conflicting
 *   file list as explanation.
 * - `D` — share file missing on current branch AND dirty conflict. Cancel
 *   is the only path forward.
 *
 * `openCurrentEnabled` / `switchEnabled` mirror the per-variant button
 * affordances; `conflictingFiles` is always present (empty on clean trees)
 * so the renderer doesn't need a discriminant check before listing files.
 */
export type BranchSwitchVariant =
  | {
      readonly kind: 'A';
      readonly openCurrentEnabled: true;
      readonly switchEnabled: true;
      readonly conflictingFiles: readonly string[];
    }
  | {
      readonly kind: 'B';
      readonly openCurrentEnabled: false;
      readonly switchEnabled: true;
      readonly conflictingFiles: readonly string[];
    }
  | {
      readonly kind: 'C';
      readonly openCurrentEnabled: true;
      readonly switchEnabled: false;
      readonly conflictingFiles: readonly string[];
    }
  | {
      readonly kind: 'D';
      readonly openCurrentEnabled: false;
      readonly switchEnabled: false;
      readonly conflictingFiles: readonly string[];
    };

/**
 * Pick the variant cell for the dialog. Pure on the `BranchInfoResponse`:
 *
 *   shareTargetExists × dirtyConflicts.conflicts → variant
 *
 *   true  × false → A
 *   false × false → B
 *   true  × true  → C
 *   false × true  → D
 *
 * `dirtyConflicts.files` is forwarded verbatim — the response already
 * intersects the dirty set with the change-set for the target branch
 * (lenient detection per `dirtyFilesOverlapWith` semantics).
 */
export function selectBranchSwitchVariant(info: BranchInfoResponse): BranchSwitchVariant {
  const targetExists = info.shareTargetExists;
  const dirty = info.dirtyConflicts.conflicts;
  const files = info.dirtyConflicts.files;
  if (targetExists && !dirty) {
    return { kind: 'A', openCurrentEnabled: true, switchEnabled: true, conflictingFiles: files };
  }
  if (!targetExists && !dirty) {
    return { kind: 'B', openCurrentEnabled: false, switchEnabled: true, conflictingFiles: files };
  }
  if (targetExists && dirty) {
    return { kind: 'C', openCurrentEnabled: true, switchEnabled: false, conflictingFiles: files };
  }
  return { kind: 'D', openCurrentEnabled: false, switchEnabled: false, conflictingFiles: files };
}

/**
 * Label for the "current" position. Named branch → branch name. Detached
 * HEAD → short SHA. The discriminated union on `detached` guarantees the
 * correct field is present per variant:
 *   - `detached: true` → `currentHeadSha: string` (non-null)
 *   - `detached: false` → `currentBranch: string | null` (null only when
 *     the server couldn't read the symbolic ref)
 *
 * Returns `'HEAD'` as a last-resort sentinel when `detached: false` but
 * `currentBranch` is null — the dialog must always render *something*
 * under the button.
 */
export function formatCurrentLabel(info: BranchInfoResponse): string {
  if (info.detached) {
    return info.currentHeadSha;
  }
  return info.currentBranch ?? 'HEAD';
}

/**
 * Discriminated outcome of `classifyCheckoutOutcome` — what the dialog
 * should do after the checkout HTTP call returns.
 *
 * - `await-cc1` — checkout succeeded; the dialog holds the pending doc
 *   in state and waits for the CC1 `branch-switched` signal to fire
 *   navigation. The client MUST NOT navigate on HTTP 200; the CRDT
 *   transition is still in flight at that point.
 * - `dismiss-with-toast` — terminal failure with no recovery path
 *   (branch deleted upstream). Dialog dismisses; caller fires the toast.
 * - `stay-with-toast` — transient failure; dialog stays open so the user
 *   can retry. Caller fires the toast.
 * - `rerender-conflict` — server re-validated and found a dirty conflict
 *   that wasn't present at branch-info time. Dialog re-renders with the
 *   fresh file list; Switch stays disabled until the conflict clears.
 */
export type CheckoutOutcome =
  | { readonly action: 'await-cc1' }
  | { readonly action: 'dismiss-with-toast'; readonly reason: 'branch-not-found' }
  | {
      readonly action: 'stay-with-toast';
      readonly reason: 'fetch-failed' | 'checkout-failed';
    }
  | { readonly action: 'rerender-conflict'; readonly files: readonly string[] }
  | {
      /**
       * In-place pivot: git refused the checkout because the requested
       * branch is held in another linked worktree. Dialog transitions to
       * the `branch-in-other-worktree` phase carrying `otherWorktreePath`
       * so the user can click "Open that worktree instead."
       */
      readonly action: 'pivot-to-other-worktree';
      readonly otherWorktreePath: string;
    };

/**
 * Classify a `POST /api/git/checkout` response into the dialog's next
 * action. Centralizes the mapping so the dialog stays declarative and the
 * STOP-rule (no navigation on HTTP 200) is enforced by the type system —
 * the only path that could navigate is `await-cc1`, which doesn't carry
 * navigation itself; the CC1 listener owns it.
 *
 * Exhaustiveness is enforced by the `_exhaustive: never` assignment in the
 * default branch: adding a new `CheckoutFailureReason` without a case here
 * makes the assignment a compile error so the dialog cannot silently fall
 * back to a generic toast for the new variant.
 */
export function classifyCheckoutOutcome(response: CheckoutResponse): CheckoutOutcome {
  if (response.ok) {
    return { action: 'await-cc1' };
  }
  switch (response.reason) {
    case 'dirty-conflict':
      return { action: 'rerender-conflict', files: response.files ?? [] };
    case 'branch-not-found':
      return { action: 'dismiss-with-toast', reason: 'branch-not-found' };
    case 'fetch-failed':
    case 'checkout-failed':
      return { action: 'stay-with-toast', reason: response.reason };
    case 'branch-in-other-worktree': {
      // Pivot in-place to the held-at worktree. If the server somehow
      // dropped otherWorktreePath (the schema makes it optional), fall back
      // to the generic stay-with-toast outcome rather than crashing the
      // dialog — the user still sees an actionable signal.
      const path = response.otherWorktreePath;
      if (path === undefined || path.length === 0) {
        return { action: 'stay-with-toast', reason: 'checkout-failed' };
      }
      return { action: 'pivot-to-other-worktree', otherWorktreePath: path };
    }
    default: {
      const _exhaustive: never = response.reason;
      throw new Error(`Unhandled CheckoutFailureReason: ${String(_exhaustive)}`);
    }
  }
}

/**
 * Dialog state machine for the branch-switch flow. Discriminated on `phase`:
 *
 * - `loading` — branch-info request is in flight. Switch + Open-current
 *   buttons are disabled; dialog shows a loading indicator.
 * - `ready` — branch-info loaded; render the variant matrix off `info`.
 * - `switching` — Switch was clicked; checkout HTTP call is in flight.
 *   `pendingDoc` is the doc the dialog will surrender to the CC1 listener
 *   when the recycle completes.
 * - `awaiting-cc1-recycle` — checkout returned `{ok: true}`; the dialog
 *   holds `pendingDoc` for the CC1 listener (registered by a follow-up
 *   story) and shows a "Switching branches…" spinner. The client MUST
 *   NOT navigate here — the CRDT transition is still in flight.
 * - `error` — branch-info request failed (proxy returned null). Dialog
 *   shows a generic load error and a single Cancel button.
 * - `dismissed` — terminal state; the dialog parent should close the
 *   dialog and surface a toast for `reason`.
 *
 * The reducer-style helpers below (`applyBranchInfo` / `markSwitching` /
 * `applyCheckoutOutcome`) are pure and exhaustively unit-tested so the
 * React component stays declarative.
 */
export type BranchSwitchDialogState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly info: BranchInfoResponse }
  | {
      readonly phase: 'switching';
      readonly info: BranchInfoResponse;
      readonly pendingDoc: string;
    }
  | {
      readonly phase: 'awaiting-cc1-recycle';
      readonly pendingDoc: string;
    }
  | {
      /**
       * In-place pivot: the checkout attempt returned `branch-in-other-
       * worktree`. Dialog renders "Branch <name> is checked out in:
       * <otherWorktreePath>" with an "Open that worktree instead" primary
       * CTA. `info` is preserved so a Cancel returns to the prior ready
       * state without re-fetching branch-info; `pendingDoc` is carried so
       * the pivot dispatch can hand it off to the next window opener.
       */
      readonly phase: 'branch-in-other-worktree';
      readonly info: BranchInfoResponse;
      readonly otherWorktreePath: string;
      readonly pendingDoc: string;
    }
  | { readonly phase: 'error' }
  | { readonly phase: 'dismissed'; readonly reason: 'branch-not-found' };

export const initialBranchSwitchState: BranchSwitchDialogState = { phase: 'loading' };

/**
 * Transition from `loading` to `ready` when branch-info arrives, or to
 * `error` when the proxy returned null. From any non-loading state this is
 * an identity no-op (defensive — branch-info should only fire once).
 */
export function applyBranchInfo(
  state: BranchSwitchDialogState,
  info: BranchInfoResponse | null,
): BranchSwitchDialogState {
  if (state.phase !== 'loading') return state;
  if (info === null) return { phase: 'error' };
  return { phase: 'ready', info };
}

/**
 * Transition from `ready` to `switching` when the user clicks Switch.
 * Stores the pending doc on the new state — the CC1 listener reads it
 * after `branch-switched` to fire navigation. From non-ready phases this
 * is an identity no-op so a delayed click can't race a checkout already
 * in flight.
 */
export function markSwitching(
  state: BranchSwitchDialogState,
  pendingDoc: string,
): BranchSwitchDialogState {
  if (state.phase !== 'ready') return state;
  return { phase: 'switching', info: state.info, pendingDoc };
}

/**
 * Discriminated reason for the toast side-effect the dialog renders when
 * `applyCheckoutOutcome` transitions out of `switching`. Made explicit so the
 * dialog doesn't have to re-derive what just happened from a prev-vs-next
 * state diff — future state-machine additions can't silently break the toast
 * path.
 *
 *   - `proxy-null` — the IPC bridge returned `null` (lock unresolvable,
 *     transient HTTP error). State falls back to `ready`; caller fires the
 *     generic "could not switch" toast.
 *   - `fetch-failed` / `checkout-failed` — transient server-side failure;
 *     state falls back to `ready` so the user can retry; caller fires the
 *     reason-specific toast.
 *   - `branch-not-found` — terminal failure (branch deleted upstream);
 *     state transitions to `dismissed`; caller fires the deletion toast
 *     and dismisses the dialog.
 *
 * `dirty-conflict` and successful checkout (`ok: true`) carry no toast — the
 * dialog re-renders with fresh files / hands off to the CC1 listener.
 */
export type CheckoutSideEffectReason =
  | 'proxy-null'
  | 'fetch-failed'
  | 'checkout-failed'
  | 'branch-not-found';

/**
 * Pair of `{state, sideEffect?}` returned by `applyCheckoutOutcome`. The
 * reducer stays pure — `sideEffect` is a typed signal the dialog component
 * reads to fire `toast(...)`. Keeps the toast set explicit so adding a new
 * state-machine arm forces an update here too.
 */
export interface ApplyCheckoutOutcomeResult {
  readonly state: BranchSwitchDialogState;
  readonly sideEffect?: { readonly kind: 'toast'; readonly reason: CheckoutSideEffectReason };
}

/**
 * Apply a `POST /api/git/checkout` response (or proxy failure) to the
 * dialog state. Pure mapping over `classifyCheckoutOutcome` + state-
 * machine transitions:
 *
 *   - `await-cc1`        → `awaiting-cc1-recycle` (holds pendingDoc; no toast)
 *   - `rerender-conflict` → `ready` with the fresh files (no toast)
 *   - `stay-with-toast`  → `ready` + toast keyed on the reason
 *   - `dismiss-with-toast` → `dismissed` + branch-not-found toast
 *   - proxy null         → `ready` + proxy-null toast
 *
 * Only callable from `switching` — defensive identity (no side effect) from
 * other phases so a delayed response can't race a state the user already
 * cancelled.
 */
export function applyCheckoutOutcome(
  state: BranchSwitchDialogState,
  response: CheckoutResponse | null,
): ApplyCheckoutOutcomeResult {
  if (state.phase !== 'switching') return { state };
  if (response === null) {
    return {
      state: { phase: 'ready', info: state.info },
      sideEffect: { kind: 'toast', reason: 'proxy-null' },
    };
  }
  const outcome = classifyCheckoutOutcome(response);
  if (outcome.action === 'await-cc1') {
    return { state: { phase: 'awaiting-cc1-recycle', pendingDoc: state.pendingDoc } };
  }
  if (outcome.action === 'rerender-conflict') {
    return {
      state: {
        phase: 'ready',
        info: {
          ...state.info,
          dirtyConflicts: { conflicts: true, files: outcome.files.slice() },
        },
      },
    };
  }
  if (outcome.action === 'pivot-to-other-worktree') {
    // In-place pivot. No toast — the dialog re-renders with the new
    // CTA ("Open that worktree instead"). pendingDoc is preserved so the
    // pivot can hand off the doc to the next window opener.
    return {
      state: {
        phase: 'branch-in-other-worktree',
        info: state.info,
        otherWorktreePath: outcome.otherWorktreePath,
        pendingDoc: state.pendingDoc,
      },
    };
  }
  if (outcome.action === 'dismiss-with-toast') {
    return {
      state: { phase: 'dismissed', reason: outcome.reason },
      sideEffect: { kind: 'toast', reason: outcome.reason },
    };
  }
  return {
    state: { phase: 'ready', info: state.info },
    sideEffect: { kind: 'toast', reason: outcome.reason },
  };
}
