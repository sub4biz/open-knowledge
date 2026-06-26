export const SYSTEM_DOC_NAME = '__system__';
export const CC1_CONTRACT_VERSION = 1;

export const CONFIG_DOC_NAME_PROJECT = '__config__/project';

export const CONFIG_DOC_NAME_USER = '__user__/config.yml';

export const CONFIG_DOC_NAME_PROJECT_LOCAL = '__local__/project';

export const CONFIG_DOC_NAME_OKIGNORE = '__config__/okignore';

export const CONFIG_DOC_NAMES = Object.freeze([
  CONFIG_DOC_NAME_PROJECT,
  CONFIG_DOC_NAME_PROJECT_LOCAL,
  CONFIG_DOC_NAME_USER,
  CONFIG_DOC_NAME_OKIGNORE,
] as const);
export type ConfigDocName = (typeof CONFIG_DOC_NAMES)[number];

export const MANAGED_ARTIFACT_PREFIX_SKILL = '__skill__/';
export const MANAGED_ARTIFACT_PREFIX_TEMPLATE = '__template__/';

export const MANAGED_ARTIFACT_SCOPES = ['project', 'global'] as const;
export type ManagedArtifactScope = (typeof MANAGED_ARTIFACT_SCOPES)[number];

export function isManagedArtifactDocName(name: string): boolean {
  return (
    name.startsWith(MANAGED_ARTIFACT_PREFIX_SKILL) ||
    name.startsWith(MANAGED_ARTIFACT_PREFIX_TEMPLATE)
  );
}

export const SKILL_CONTENT_ROOT = '.ok/skills';

export function projectSkillContentDocName(name: string): string {
  return `${SKILL_CONTENT_ROOT}/${name}/SKILL`;
}

const SKILL_BUNDLE_SUBDIRS = ['references', 'scripts'] as const;

export function resolveSkillBundleWikiTarget(target: string, sourceDocName: string): string | null {
  const skillDirMatch = /^(\.ok\/skills\/[^/]+)\/SKILL$/.exec(sourceDocName);
  if (!skillDirMatch) return null;
  const skillDir = skillDirMatch[1] as string;

  const trimmed = target.trim();
  const withoutExt = trimmed.replace(/\.mdx?$/i, '');
  const segments = withoutExt.split('/').filter((s) => s !== '' && s !== '.');
  const [first] = segments;
  if (!first || !(SKILL_BUNDLE_SUBDIRS as readonly string[]).includes(first)) return null;
  if (segments.includes('..')) return null;
  if (segments.length < 2) return null;
  return `${skillDir}/${segments.join('/')}`;
}

export type ParsedProjectSkillBundleDoc =
  | { name: string; kind: 'skill'; rel: null }
  | { name: string; kind: 'reference'; rel: string };

const PROJECT_SKILL_BUNDLE_DOC_RE = /^\.ok\/skills\/([^/]+)\/(SKILL|references\/.+)$/;

export function parseProjectSkillBundleDoc(docName: string): ParsedProjectSkillBundleDoc | null {
  const match = PROJECT_SKILL_BUNDLE_DOC_RE.exec(docName);
  if (!match) return null;
  const name = match[1] as string;
  const tail = match[2] as string;
  if (tail === 'SKILL') return { name, kind: 'skill', rel: null };
  return { name, kind: 'reference', rel: tail.slice('references/'.length) };
}

export type ParsedGlobalSkillBundleDoc =
  | { name: string; kind: 'skill'; rel: null }
  | { name: string; kind: 'reference'; rel: string };

const GLOBAL_SKILL_BUNDLE_DOC_RE = /^__skill__\/global\/([^/]+)(?:\/(references\/.+))?$/;

export function parseGlobalSkillBundleDoc(docName: string): ParsedGlobalSkillBundleDoc | null {
  const match = GLOBAL_SKILL_BUNDLE_DOC_RE.exec(docName);
  if (!match) return null;
  const name = match[1] as string;
  const tail = match[2];
  if (tail === undefined) return { name, kind: 'skill', rel: null };
  return { name, kind: 'reference', rel: tail.slice('references/'.length) };
}

export function skillLiveDocName(scope: ManagedArtifactScope, name: string): string {
  return scope === 'project'
    ? projectSkillContentDocName(name)
    : `${MANAGED_ARTIFACT_PREFIX_SKILL}${scope}/${name}`;
}

export type ParsedManagedArtifactName =
  | { kind: 'skill'; scope: ManagedArtifactScope; name: string }
  | { kind: 'template'; folder: string; name: string };

function decodeManagedSegments(encoded: string): string {
  if (encoded === '') return '';
  try {
    return encoded
      .split('/')
      .map((s) => decodeURIComponent(s))
      .join('/');
  } catch {
    return encoded;
  }
}

export function parseManagedArtifactName(name: string): ParsedManagedArtifactName | null {
  if (name.startsWith(MANAGED_ARTIFACT_PREFIX_SKILL)) {
    const rest = name.slice(MANAGED_ARTIFACT_PREFIX_SKILL.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return null;
    const scope = rest.slice(0, slash);
    if (scope !== 'global' && scope !== 'project') return null;
    const encoded = rest.slice(slash + 1);
    if (!encoded) return null;
    return { kind: 'skill', scope, name: decodeManagedSegments(encoded) };
  }
  if (name.startsWith(MANAGED_ARTIFACT_PREFIX_TEMPLATE)) {
    const rest = name.slice(MANAGED_ARTIFACT_PREFIX_TEMPLATE.length);
    if (!rest) return null;
    const lastSlash = rest.lastIndexOf('/');
    const encodedName = lastSlash < 0 ? rest : rest.slice(lastSlash + 1);
    if (!encodedName) return null;
    const encodedFolder = lastSlash < 0 ? '' : rest.slice(0, lastSlash);
    return {
      kind: 'template',
      folder: decodeManagedSegments(encodedFolder),
      name: decodeManagedSegments(encodedName),
    };
  }
  return null;
}

const TEMPLATE_FILE_TARGET_RE = /^(?:(.+)\/)?\.ok\/templates\/([^/]+?)(?:\.mdx?)?$/;

export function managedArtifactDocNameFromContentTarget(target: string): string | null {
  const template = TEMPLATE_FILE_TARGET_RE.exec(target);
  if (template) {
    const folder = (template[1] ?? '').replace(/^\/+|\/+$/g, '');
    return `${MANAGED_ARTIFACT_PREFIX_TEMPLATE}${folder ? `${folder}/` : ''}${template[2]}`;
  }
  return null;
}
