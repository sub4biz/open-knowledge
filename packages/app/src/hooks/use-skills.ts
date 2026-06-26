import { type SkillsListEntry, SkillsListSuccessSchema } from '@inkeep/open-knowledge-core';
import { useEffect, useState } from 'react';
import { subscribeToDocumentsChanged, subscribeToSkillsChanged } from '@/lib/documents-events';
import { parseApiError } from '@/lib/parse-api-error';
import type { AsyncState } from './use-folder-config';

export function useSkills(options?: { enabled?: boolean }): AsyncState<readonly SkillsListEntry[]> {
  const enabled = options?.enabled ?? true;
  const [state, setState] = useState<AsyncState<readonly SkillsListEntry[]>>({ status: 'idle' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const bump = () => setRefreshKey((k) => k + 1);
    const unsubLocal = subscribeToSkillsChanged(bump);
    const unsubRemote = subscribeToDocumentsChanged((channels) => {
      if (channels.includes('files')) bump();
    });
    return () => {
      unsubLocal();
      unsubRemote();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fetch trigger is the only purpose of refreshKey
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((prev) => (prev.status === 'ready' ? prev : { status: 'loading' }));
    fetch('/api/skills')
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as unknown;
          throw new Error(parseApiError(body) ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (cancelled) return;
        const parsed = SkillsListSuccessSchema.safeParse(payload);
        if (!parsed.success) {
          console.error(
            '[ok-skills] /api/skills response failed schema validation:',
            parsed.error.issues,
          );
          setState({ status: 'error', message: 'Server returned an incomplete skills response.' });
          return;
        }
        setState({ status: 'ready', data: parsed.data.skills });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, enabled]);

  return state;
}
