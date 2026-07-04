/**
 * Install a subscriber for the Desktop `ok:deep-link` bridge event. When
 * an `openknowledge://` URL routes to this window, main fires the bridge
 * event with `{ doc, kind, branch? }`; this installer updates
 * `window.location.hash` so the existing hash-route listener in App opens
 * the target.
 *
 * The hash form dispatches on `evt.kind` (see `encodeShareTargetForHash`):
 *   - `kind: 'doc'` → `#/<doc>`, with `branch` riding as a `?branch=<encoded>`
 *     query param when present (mirrors the `?anchor=...` pattern in
 *     `doc-hash.ts`). Absent / null / empty branch keeps the bare `#/<doc>`
 *     form — back-compat with legacy emitters preserved.
 *   - `kind: 'folder'` → `#/<folderPath>/` (trailing-slash folder form),
 *     matching how in-app folder navigation builds its hash. An empty `doc`
 *     is the content-root sentinel → `#/` (contentDir root). No `?branch=`
 *     is appended: the branch-switch decision resolves upstream before the
 *     dispatched window navigates.
 *
 * Registered imperatively during main.tsx module init (not inside a React
 * effect) so the `ipcRenderer.on` listener is in place before the main process
 * fires the event on `dom-ready` or later.
 *
 * Dispatched-window toast: in the dispatched window of a multi-worktree
 * share-receive, emit a brief toast naming the branch + worktree path.
 * The deep-link payload carries the branch the share asked for; the
 * window already knows its own `projectPath` via `bridge.config`.
 *
 * Suppressed when:
 *   - the share carried no branch (legacy single-clone receivers'
 *     shares pre-branch-awareness — nothing useful to disambiguate)
 *   - the dispatcher signals `multiCandidate === false` / absent
 *     single-clone receivers — the user has one window matching the
 *     repo, so confirmation copy adds noise without disambiguation
 *     value)
 *
 * Toasts only when `multiCandidate === true`: the dispatcher's
 * candidate-selection had >1 entries, the user's window choice was
 * non-trivial, and the receiver benefits from knowing which window
 * the share landed in.
 *
 * No-op in web / CLI distribution (window.okDesktop undefined). In Desktop,
 * returns the bridge-provided unsubscribe so the caller can detach on
 * hot-module-replacement or teardown.
 */

import { toast } from 'sonner';
import type { OkDesktopBridge } from '@/lib/desktop-bridge-types';
import { encodeShareTargetForHash } from '@/lib/doc-hash';

interface InstallDeepLinkListenerOptions {
  /** Bridge resolved from `window.okDesktop`. Absent in web/CLI. */
  bridge: OkDesktopBridge | undefined;
  /**
   * Hash-setter override for tests. Production: writes
   * `window.location.hash = '#/' + encodeURIComponent(doc)`.
   */
  setHash?: (hash: string) => void;
  /**
   * Toast emitter override for tests. Production: calls `sonner`'s
   * `toast(message, { description, duration })`. Tests pass a spy.
   */
  emitToast?: (message: string, opts: { description: string; duration: number }) => void;
}

/**
 * Pure helper: derive the share-receive toast payload from a deep-link
 * event and the window's projectPath. Returns null when the toast should
 * be suppressed (no branch, or no projectPath) so the call site never has
 * to repeat the branching. Extracted for unit testability — the toast()
 * call itself is side-effectful and lives in the bridge listener.
 */
export function deriveShareReceiveToast(
  evt: { doc: string; branch?: string | null; multiCandidate?: boolean },
  projectPath: string,
): { message: string; description: string } | null {
  // Toast keys off branch + multiCandidate only — kind-agnostic.
  if (evt.branch === undefined || evt.branch === null || evt.branch === '') return null;
  if (projectPath === '') return null;
  // Single-clone suppression: only emit the toast when the
  // dispatcher signals that selection evaluated more than one
  // candidate. Treat undefined / false identically — legacy emitters
  // and explicit single-clone dispatches collapse to "no toast." The
  // toast is dispatcher-disambiguation copy; without a real
  // disambiguation choice it is noise.
  if (evt.multiCandidate !== true) return null;
  return {
    message: `Opened on branch ${evt.branch}`,
    description: projectPath,
  };
}

export function installDeepLinkListener(
  opts: InstallDeepLinkListenerOptions,
): (() => void) | undefined {
  const bridge = opts.bridge;
  if (!bridge) return undefined;

  const setHash =
    opts.setHash ??
    ((hash: string) => {
      window.location.hash = hash;
    });
  const emitToast =
    opts.emitToast ??
    ((message: string, toastOpts: { description: string; duration: number }) => {
      toast(message, toastOpts);
    });
  return bridge.onDeepLink((evt) => {
    // `evt.kind` defaults to 'doc' for legacy emitters that predate
    // folder-share — those payloads carry no `kind`, and the doc form is the
    // back-compat target.
    const kind = evt.kind ?? 'doc';
    // Stale-branch gate: main's target-existence probe found the share's
    // target absent on the receiver's checked-out branch (target added on the
    // remote branch but not yet fetched). Surface a toast in-context instead
    // of navigating into a blank editor / empty folder, and skip the hash nav
    // so the window stays on its current view.
    if (evt.targetMissing === true) {
      const label = kind === 'folder' ? 'folder' : 'file';
      const onBranch =
        evt.branch === undefined || evt.branch === null || evt.branch === ''
          ? ''
          : ` on branch ${evt.branch}`;
      emitToast(`This ${label} isn't in your local checkout${onBranch} yet`, {
        description: 'Pull the latest changes, then open the share link again.',
        duration: 5000,
      });
      return;
    }
    // `branch` rides the hash as `?branch=` ONLY for doc shares (a
    // defense-in-depth signal for the renderer's branch-switch trigger). Folder
    // shares resolve the branch-switch upstream before navigation, so the folder
    // hash carries no branch — pass `undefined` so the drop is explicit at the
    // call site rather than silently discarded inside encodeShareTargetForHash.
    setHash(encodeShareTargetForHash(kind, evt.doc, kind === 'doc' ? evt.branch : undefined));
    const payload = deriveShareReceiveToast(evt, bridge.config.projectPath);
    if (payload !== null) {
      emitToast(payload.message, { description: payload.description, duration: 3000 });
    }
  });
}
