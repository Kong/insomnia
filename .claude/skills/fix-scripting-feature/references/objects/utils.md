# Utils (misc helpers)

**Source:** `packages/insomnia-scripting-environment/src/objects/utils.ts`

## Purpose
Single-function utility module. Currently contains only a helper used to detect whether a request
URL still contains unresolved template-tag syntax, which affects client-certificate matching in
`insomnia.ts`.

## Public API

### `function checkIfUrlIncludesTag(url: string): boolean`
```ts
export function checkIfUrlIncludesTag(url: string): boolean {
  return /{%/.test(`${url}`) || /%}/.test(`${url}`) || /{{/.test(`${url}`) || /}}/.test(`${url}`);
}
```
Returns `true` if the given `url` (coerced to a string via template literal) contains any of the
four Liquid/interpolation delimiter substrings: `{%`, `%}`, `{{`, `}}`. Used as a proxy for "this
URL hasn't been fully rendered yet" / "this URL has dynamic template parts that can't be resolved
against a fixed hostname".

## Script-facing surface
None. This is internal plumbing — it is not exposed on `insomnia`/`pm` and scripts cannot call it.

## Gotchas / notable behavior
- The check is purely textual (four independent regex tests, not a real template parser) — it will
  return `true` for a URL that merely contains a literal `{{` or `}}` substring even if it isn't
  actually meant as an interpolation tag.
- `` `${url}` `` coercion means passing `undefined`/`null`/non-string values won't throw; they'll be
  stringified first (e.g. `undefined` becomes the string `"undefined"`, which does not match any
  pattern, so the function returns `false`).

## Related
- `insomnia.ts` — the only current caller. `initInsomniaObject` uses `checkIfUrlIncludesTag(rawObj.request.url)` together with `filterClientCertificates` (from `insomnia/src/network/certificate`) to decide whether to fall back to an empty default client certificate (since a templated URL's real host can't be matched against certificate rules yet).
