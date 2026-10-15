# Interpolator (template-tag rendering)

**Source:** `packages/insomnia-scripting-environment/src/objects/interpolator.ts`

## Purpose
Internal helper providing `{{variable}}`-style template rendering (plus `{{$fakerFn}}` dynamic
value generation) on top of LiquidJS. It backs every "replace variables in this string" operation
exposed by the environment/property objects (e.g. `insomnia.environment.replaceIn(...)`).

## Public API

### `class Interpolator` (not exported — module-private)
```ts
constructor()
```
Builds a `Liquid` engine configured with:
- `outputDelimiterLeft: '{{'`, `outputDelimiterRight: '}}'` — variable interpolation delimiters.
- `tagDelimiterLeft: '{%'`, `tagDelimiterRight: '%}'` — Liquid tag delimiters (e.g. `{% if %}`).
- `strictVariables: true` — referencing an undefined variable causes a render error rather than silently rendering empty.
- `jsTruthy: true` — use JS truthiness semantics instead of Liquid's default truthy rules.
- `ownPropertyOnly: false` — allows resolving inherited/prototype properties on the context object, not just own properties.

Methods:
- `render = async (template: string, context: object): Promise<string>` — runs `renderWithFaker(template)` first (to substitute any `{{$fakerFn}}` tags with generated values), then parses/renders the result through the Liquid engine against `context`. Comment: `// TODO: support plugins`.
- `renderWithFaker = (template: string) => string` — a pre-pass over the template string, done via
  manual string splitting (not Liquid) rather than regex/AST parsing:
  1. Splits `template` on `'}}'`.
  2. For each segment, finds the last `'{{'` before the end of the segment.
  3. If the found tag name starts with `'$'`, strips the `$` prefix, looks it up in
     `fakerFunctions` (from `insomnia/src/common/templating/faker-functions`), calls it, and
     splices the generated value in place of the tag.
  4. If the tag name does not start with `$`, the segment (and its `}}`) is left untouched for the
     real Liquid engine to interpolate as a normal variable.
  5. Throws `Error('replaceIn: no faker function is found: ${funcName}')` if the `$`-prefixed name
     isn't a recognized faker function.

### `function getInterpolator(): Interpolator`
Returns the single module-level `Interpolator` instance (`const interpolator = new Interpolator();`), constructed once at module load. This is the only exported symbol.

## Script-facing surface
No direct surface — scripts never call `getInterpolator()` themselves. It is reached indirectly
through higher-level methods on other objects, all of which delegate to
`getInterpolator().render(...)`:
- `insomnia.environment.replaceIn(template)` / same method on `baseEnvironment`, `collectionVariables`, `variables`, etc. (defined in `environments.ts`) — e.g. `insomnia.environment.replaceIn("My id is {{$randomUUID}}")` or `insomnia.environment.replaceIn("Visiting URL: {{urlValueFromEnvironment}}")`.
- `Property.replaceSubstitutions(content, ...variables)` and `Property.replaceSubstitutionsIn(obj, ...variables)` (static methods in `properties.ts`) — used internally wherever a `Property`-derived object needs variable substitution against multiple variable-scope objects merged together.

## Gotchas / notable behavior
- `renderWithFaker` is a hand-rolled string scan, not a real parser — it looks for the *last*
  `'{{'` before each `'}}'` boundary in each split segment. Malformed or nested template syntax
  could confuse this pass before Liquid ever sees the template.
- `strictVariables: true` means referencing a variable name that isn't present in `context` will
  cause the Liquid render to throw/reject, not silently produce an empty string — a common source
  of "my `{{someVar}}` template failed" script errors when the variable isn't actually defined in
  any active scope.
- `$`-prefixed faker tags are resolved by this module's own pre-pass, *before* Liquid — an unknown
  `$xyz` faker function name throws synchronously from `renderWithFaker` with the message
  `replaceIn: no faker function is found: xyz`.
- `getInterpolator()` always returns the same singleton `Interpolator` instance across the whole
  process — there is no way to get a differently-configured interpolator or to reset its Liquid
  engine mid-run.
- The `Interpolator` class itself is not exported; only `getInterpolator()` is, so consumers cannot
  construct their own instance or subclass it.

## Related
- `environments.ts` — `Environment`/`Variables`/`Vault`'s `replaceIn(...)` methods call `getInterpolator().render(...)`.
- `properties.ts` — `Property.replaceSubstitutions`/`replaceSubstitutionsIn` call `getInterpolator().render(...)`.
- `insomnia/src/common/templating/faker-functions` (outside this package) — supplies the `fakerFunctions` map used for `{{$fakerFn}}` tags.
