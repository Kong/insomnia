import { OA3ServerVariable } from '../types/openapi3';

const protocolSearchValue = /{([^}]+)}(?=:\/\/)/g; // positive lookahead for ://

const pathSearchValue = /{([^}]+)}(?!:\/\/)/g; // negative lookahead for ://

export function resolveUrlVariables(url: string, variables?: Record<string, OA3ServerVariable>): string {
  const protocolResolved = resolveVariables(url, protocolSearchValue, 'http', variables);
  const pathResolved = resolveVariables(protocolResolved, pathSearchValue, '.*', variables);
  return pathResolved;
}
export function resolveVariables(
  str: string,
  regExp: RegExp,
  fallback: string,
  variables?: Record<string, OA3ServerVariable>,
): string {
  let resolved = str;
  let shouldContinue = true;

  do {
    // Regexp contain the global flag (g), meaning we must execute our regex on the original string.
    // https://stackoverflow.com/a/27753327
    const [replace, name] = regExp.exec(str) || [];
    const value = variables?.[name]?.default || fallback;
    shouldContinue = !!name;
    resolved = replace ? resolved.replace(replace, value) : resolved;
  } while (shouldContinue);

  return resolved;
}
export function pathVariablesToWildcard(p: string): string {
  return p.replace(pathSearchValue, '.*');
}
