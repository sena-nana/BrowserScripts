export type RunAt = 'document-start' | 'document-body' | 'document-end' | 'document-idle';
export type InjectInto = 'page' | 'content' | 'auto';

export interface UserscriptMeta {
  id: string;
  name: string;
  namespace: string;
  version: string;
  description: string;
  match: string | string[];
  grant?: string[];
  runAt?: RunAt;
  noframes?: boolean;
  injectInto?: InjectInto;
  excludeMatch?: string[];
  downloadURL?: string;
  updateURL?: string;
  supportURL?: string;
  homepageURL?: string;
  connect?: string[];
  resource?: Record<string, string>;
}

export function defineUserscriptMeta(meta: UserscriptMeta): UserscriptMeta {
  validateUserscriptMeta(meta);
  return meta;
}

export function getMetaMatches(meta: UserscriptMeta): string[] {
  return Array.isArray(meta.match) ? meta.match : [meta.match];
}

export function getMetaGrants(meta: UserscriptMeta): string[] {
  return meta.grant?.length ? meta.grant : ['none'];
}

export function validateUserscriptMeta(meta: UserscriptMeta): void {
  const errors: string[] = [];

  if (!/^[a-z0-9][a-z0-9-]*$/.test(meta.id)) {
    errors.push('id must use lowercase letters, numbers, and hyphens');
  }

  for (const [field, value] of Object.entries({
    name: meta.name,
    namespace: meta.namespace,
    version: meta.version,
    description: meta.description
  })) {
    if (!String(value).trim()) {
      errors.push(`${field} is required`);
    }
  }

  const matches = getMetaMatches(meta);

  if (matches.length === 0 || matches.some((match) => !match.trim())) {
    errors.push('at least one @match is required');
  }

  if (matches.some((match) => match === '*://*/*' || match === '*')) {
    errors.push('global @match patterns require an explicit project decision');
  }

  if (meta.excludeMatch?.some((match) => !match.trim())) {
    errors.push('@exclude-match values cannot be empty');
  }

  const grants = getMetaGrants(meta);

  if (grants.length > 1 && grants.includes('none')) {
    errors.push('@grant none cannot be combined with privileged grants');
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(meta.version)) {
    errors.push('version must be semver-like, for example 0.1.0');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid metadata for ${meta.id}: ${errors.join('; ')}`);
  }
}
