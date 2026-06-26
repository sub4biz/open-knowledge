import {
  type SkillTargetEditor,
  type SkillTargetsGetSuccess,
  SkillTargetsGetSuccessSchema,
} from '@inkeep/open-knowledge-core';
import { useEffect, useState } from 'react';
import { emitSkillsChanged } from '@/lib/documents-events';
import { parseApiError } from '@/lib/parse-api-error';
import type { AsyncState } from './use-folder-config';

export interface SkillTargetsHandle {
  state: AsyncState<SkillTargetsGetSuccess>;
  save: (targets: SkillTargetEditor[]) => Promise<void>;
  saving: boolean;
}

export function useSkillTargets(): SkillTargetsHandle {
  const [state, setState] = useState<AsyncState<SkillTargetsGetSuccess>>({ status: 'idle' });
  const [refreshKey, setRefreshKey] = useState(0);
  const [saving, setSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fetch trigger is the only purpose of refreshKey
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetch('/api/skill-targets')
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as unknown;
          throw new Error(parseApiError(body) ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (cancelled) return;
        const parsed = SkillTargetsGetSuccessSchema.safeParse(payload);
        if (!parsed.success) {
          console.error(
            '[ok-skills] /api/skill-targets response failed schema validation:',
            parsed.error.issues,
          );
          setState({
            status: 'error',
            message: 'Server returned an incomplete skill-targets response.',
          });
          return;
        }
        setState({ status: 'ready', data: parsed.data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const save = async (targets: SkillTargetEditor[]): Promise<void> => {
    setSaving(true);
    const res = await fetch('/api/skill-targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targets }),
    }).catch(() => null);
    if (!res?.ok) {
      setSaving(false);
      const body = res ? ((await res.json().catch(() => null)) as unknown) : null;
      throw new Error(parseApiError(body) ?? (res ? `HTTP ${res.status}` : 'Request failed'));
    }
    emitSkillsChanged();
    setRefreshKey((k) => k + 1);
    setSaving(false);
  };

  return { state, save, saving };
}
