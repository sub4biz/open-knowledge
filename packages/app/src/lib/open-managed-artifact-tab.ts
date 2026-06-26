import { hashFromDocName } from '@/lib/doc-hash';

export function openManagedArtifactTab(docName: string): void {
  if (typeof window === 'undefined') return;
  const hash = hashFromDocName(docName);
  if (window.location.hash !== hash) window.location.hash = hash;
}
