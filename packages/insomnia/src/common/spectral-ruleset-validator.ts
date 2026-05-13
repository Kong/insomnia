import ipaddr from 'ipaddr.js';
import YAML from 'yaml';

export type SpectralRulesetValidationResult = { isValid: true } | { isValid: false; error: string };

// Top-level keys we support. Everything else within Spectral (notably `functions`, `aliases`,
// `overrides`, `parserOptions`, top-level `documentationUrl`) is rejected by
// default.
const ALLOWED_TOP_LEVEL_PROPERTIES = ['rules', 'extends'];

// These are the only built-in Spectral identities we allow in the extends property.
const ALLOWED_EXTENDS_IDENTIFIERS = ['spectral:oas', 'spectral:asyncapi', 'spectral:arazzo'];

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

const PROTOTYPE_POLLUTION_TOKENS = ['__proto__', 'prototype', 'constructor'];

const SAFE_URL_SCHEMES = ['https:'];

export function validateSpectralRuleset(content: string): SpectralRulesetValidationResult {
  if (typeof content !== 'string' || content.trim() === '') {
    return fail('Ruleset file is empty.');
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (err) {
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
    return fail(
      `Ruleset contains unsupported top-level keys: ${disallowed.join(', ')}. Only "rules" and "extends" are allowed.`,
    );
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

function validateExtends(value: unknown): string | null {
  for (const entry of toArray(value)) {
    if (typeof entry !== 'string') {
      return '"extends" entries must be strings.';
    }
    if (ALLOWED_EXTENDS_IDENTIFIERS.includes(entry)) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      return `"extends" entry "${entry}" is not a recognized Spectral identifier or a valid URL.`;
    }
    if (!SAFE_URL_SCHEMES.includes(url.protocol)) {
      return `"extends" entry "${entry}" must use https (got "${url.protocol}").`;
    }
    if (!url.hostname || isPrivateOrLoopbackHost(url.hostname.toLocaleLowerCase())) {
      return `"extends" entry "${entry}" targets a disallowed host`;
    }
  }
  return null;
}

// Note: The logic in this function is duplicated in the main process's Spectral linting handler (lint-process.mjs) to protect against SSRF via $ref resolution in extends files.
// If logic is changed here, mirror it there.
export function isPrivateOrLoopbackHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true;
  }
  const host = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (!ipaddr.isValid(host)) {
    return false;
  }
  return ipaddr.process(host).range() !== 'unicast';
}

function validateRules(value: unknown): string | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return '"rules" must be an object.';
  }

  for (const [ruleName, rule] of Object.entries(value as Record<string, unknown>)) {
    if (PROTOTYPE_POLLUTION_TOKENS.includes(ruleName)) {
      return `Rule name "${ruleName}" is not allowed.`;
    }

    if (rule === true || rule === false || typeof rule === 'string') {
      continue;
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

function validateThen(ruleName: string, then: Record<string, unknown>): string | null {
  // We do not allow javascript prototype pollution via the "field" property
  if (typeof then.field === 'string' && (containsPrototypePollution(then.field) || /[.\[\]]/.test(then.field))) {
    return `Rule "${ruleName}" has a "field" containing a disallowed token or traversal syntax.`;
  }

  // only Spectral's documented built-in functions are reachable.
  if (then.function !== undefined) {
    if (typeof then.function !== 'string' || !ALLOWED_BUILTIN_FUNCTIONS.includes(then.function)) {
      return `Rule "${ruleName}" uses function "${String(then.function)}" which is not an allowed Spectral built-in.`;
    }
  }

  return null;
}

function containsPrototypePollution(value: string): boolean {
  return PROTOTYPE_POLLUTION_TOKENS.some(token => value.includes(token));
}

function isSafeUrl(value: string): boolean {
  try {
    return SAFE_URL_SCHEMES.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function fail(error: string): SpectralRulesetValidationResult {
  return { isValid: false, error };
}
