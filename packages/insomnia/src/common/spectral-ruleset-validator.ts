import YAML from 'yaml';

export type SpectralRulesetValidationResult = { isValid: true } | { isValid: false; error: string };

// Top-level keys we support. We reject everything else for the time being.
// When adding new top-level properties, consider how they might be abused and how to mitigate.
const ALLOWED_TOP_LEVEL_PROPERTIES = ['rules', 'extends'];

// These are the only built-in Spectral identities we allow in the extends property.
export const ALLOWED_EXTENDS_IDENTIFIERS = ['spectral:oas', 'spectral:asyncapi', 'spectral:arazzo'];

// These are the only built-in Spectral functions we allow in ruleset "then" clauses
const ALLOWED_BUILTIN_FUNCTIONS = [
  'alphabetical',
  'casing',
  'defined',
  'enumeration',
  'falsy',
  'length',
  'pattern',
  'schema',
  'truthy',
  'typedEnum',
  'undefined',
  'unreferencedReusableObject',
  'or',
  'xor',
];

// For security reasons we do not allow rulesets to contain certain tokens that could be used for JavaScript prototype pollution when used in certain Spectral properties (e.g. "field").
const PROTOTYPE_POLLUTION_TOKENS = ['__proto__', 'prototype', 'constructor'];

export function toArray<T>(value: T | T[] | undefined): T[] {
  //no extends key in the ruleset
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value]; // handles both array and single value cases for extends in a given ruleset
}

function containsPrototypePollution(value: string): boolean {
  return PROTOTYPE_POLLUTION_TOKENS.some(token => value.includes(token));
}

// Guards a rule's "documentationUrl"
function isSafeUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function fail(error: string): SpectralRulesetValidationResult {
  return { isValid: false, error };
}

function validateThen(ruleName: string, then: Record<string, unknown>): string | null {
  // We do not allow javascript prototype pollution via the "field" property as well as square brackets/dot notation that could traverse beyond a single property level.
  if (typeof then.field === 'string' && (containsPrototypePollution(then.field) || /[.\[\]]/.test(then.field))) {
    return `Rule "${ruleName}" has an invalid "field" value "${then.field}". The "field" must be a plain property name. It cannot contain ".", "[", or "]", or use reserved names like __proto__, prototype, or constructor.`;
  }

  // only Spectral's documented built-in functions are reachable.
  if (
    then.function !== undefined &&
    (typeof then.function !== 'string' || !ALLOWED_BUILTIN_FUNCTIONS.includes(then.function))
  ) {
    return `Rule "${ruleName}" uses function "${String(then.function)}" which is not an allowed Spectral built-in function.`;
  }

  return null;
}

// Structural check only: each "extends" entry must be a plain string. Whether an entry is a valid
// identifier, local path, or remote URL — and whether a remote URL is safe to fetch (SSRF) — is
// decided when the ruleset is bundled (see common/bundle-spectral-ruleset.ts).
function validateExtends(value: unknown): string | null {
  for (const entry of toArray(value)) {
    if (Array.isArray(entry)) {
      return `"extends" entry ${JSON.stringify(entry)} uses tuple format (e.g. [path, severity]) which is not supported. Use a plain string instead.`;
    }
    if (typeof entry !== 'string') {
      return '"extends" entries must be strings.';
    }
  }
  return null;
}

function validateRules(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return '"rules" must be an object.';
  }

  for (const [ruleName, rule] of Object.entries(value as Record<string, unknown>)) {
    // allow shorthand rule definitions (boolean or severity string)
    if (rule === true || rule === false || typeof rule === 'string') {
      continue;
    }
    // protect against Javascript prototype pollution
    if (PROTOTYPE_POLLUTION_TOKENS.includes(ruleName)) {
      return `Rule name "${ruleName}" is not allowed.`;
    }

    if (rule === null || typeof rule !== 'object') {
      return `Rule "${ruleName}" must be an object, boolean, or severity string.`;
    }

    const ruleError = validateRuleBody(ruleName, rule as Record<string, unknown>);
    if (ruleError) {
      return ruleError;
    }
  }
  return null;
}

function validateRuleBody(ruleName: string, rule: Record<string, unknown>): string | null {
  for (const given of toArray(rule.given)) {
    if (typeof given === 'string' && containsPrototypePollution(given)) {
      return `Rule "${ruleName}" has a "given" expression containing a disallowed token.`;
    }
  }

  if (typeof rule.documentationUrl === 'string' && !isSafeUrl(rule.documentationUrl)) {
    return `Rule "${ruleName}" has a "documentationUrl" with a disallowed URL scheme.`;
  }

  const thenEntries = toArray(rule.then);
  for (const then of thenEntries) {
    if (then === null || typeof then !== 'object') {
      continue;
    }
    const thenError = validateThen(ruleName, then as Record<string, unknown>);
    if (thenError) {
      return thenError;
    }
  }
  return null;
}

export function validateSpectralRuleset(content: string): SpectralRulesetValidationResult {
  if (typeof content !== 'string' || content.trim() === '') {
    return fail('Ruleset file is empty.');
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch {
    return fail(`Ruleset is not valid YAML or JSON`);
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return fail('Ruleset must be an object at the top level.');
  }

  const ruleset = parsed as Record<string, unknown>;
  const keys = Object.keys(ruleset);
  if (keys.length === 0) {
    return fail('Ruleset must declare at least one of: rules, extends.');
  }

  const disallowed = keys.filter(key => !ALLOWED_TOP_LEVEL_PROPERTIES.includes(key));
  if (disallowed.length > 0) {
    return fail(`Ruleset contains unsupported top-level keys. Only "rules" and "extends" are allowed.`);
  }

  if ('extends' in ruleset) {
    const extendsError = validateExtends(ruleset.extends);
    if (extendsError) {
      return fail(extendsError);
    }
  }

  if ('rules' in ruleset) {
    const rulesError = validateRules(ruleset.rules);
    if (rulesError) {
      return fail(rulesError);
    }
  }

  return { isValid: true };
}
