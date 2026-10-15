# RequestAuth

**Source:** `packages/insomnia-scripting-environment/src/objects/auth.ts`

## Purpose
Models the authentication settings attached to a request (`pm.request.auth`). It stores auth options per-type in a map (so switching `type` doesn't destroy other types' saved options), and provides the two-way transform functions used to convert between Insomnia's native `RequestAuthentication` model and the script-facing `AuthOptions` shape. `RequestAuth` extends `Property` (see `properties.ts`).

## Public API

### Types
- `type AuthOptionTypes = 'noauth' | 'basic' | 'bearer' | 'jwt' | 'digest' | 'oauth1' | 'oauth2' | 'hawk' | 'awsv4' | 'ntlm' | 'apikey' | 'edgegrid' | 'asap' | 'netrc'` — the full set of auth type strings the SDK models are aware of, but not all are reachable from scripts (see Gotchas).
- `const AuthTypes: Set<string>` — a `Set` containing the same string values as `AuthOptionTypes`, used by `RequestAuth.isValidType`.
- `interface AuthOption { key: string; value: string; type?: string }` — a single key/value auth parameter (e.g. `{ key: 'username', value: 'user1' }`).
- `interface OAuth2AuthOption { key: string; value: string | OAuth2Param[]; type?: string }` — like `AuthOption` but OAuth2 params can themselves be arrays of `OAuth2Param` (used for nested `tokenRequestParams` etc.).
- `interface OAuth2Param { key: string; value: string; enabled: boolean; send_as: string }`.
- Per-auth-type option interfaces (shape of the fields you'd set for `.use()`/`.update()` when constructing raw options rather than key/value arrays): `BasicOptions`, `BearerOptions`, `JWTOptions`, `DigestOptions`, `OAuth1Options`, `OAuth2Options`, `HAWKOptions`, `AWSV4Options`, `NTLMOptions`, `APIKeyOptions`, `EdgegridOptions`, `ASAPOptions`. Each mirrors the field names used by the corresponding Insomnia auth UI (e.g. `OAuth1Options` has `consumerKey`, `consumerSecret`, `signatureMethod`, etc.) and all have an optional `id?: string`.
- `interface AuthOptions { type: AuthOptionTypes; basic?: AuthOption[]; bearer?: AuthOption[]; jwt?: AuthOption[]; digest?: AuthOption[]; oauth1?: AuthOption[]; oauth2?: OAuth2AuthOption[]; hawk?: AuthOption[]; awsv4?: AuthOption[]; ntlm?: AuthOption[]; apikey?: AuthOption[]; edgegrid?: AuthOption[]; asap?: AuthOption[] }` — the JSON shape used to construct a `RequestAuth` and returned by `toJSON()`/`toPreRequestAuth()`. Each type's key holds an array of `AuthOption` (or `OAuth2AuthOption` for oauth2).

### Functions
- `authOptionsToParams(authMethod: BasicOptions | BearerOptions | ... | ASAPOptions)` — converts a flat options object (e.g. `{ username, password }`) into an array of `{ type: 'any', key, value }` entries. Not used internally by `RequestAuth`; appears to be a helper for callers building `AuthOption[]` from a typed options object.
- `fromPreRequestAuth(auth: RequestAuth): RequestAuthentication` — converts a script-side `RequestAuth` into Insomnia's native `RequestAuthentication` model (used when a pre-request script finishes and Insomnia needs to write the mutated auth back onto the real request). Calls `auth.toJSON()` then switches on `type`.
- `toPreRequestAuth(auth: RequestAuthentication | {}): AuthOptions` — the reverse transform: converts Insomnia's native auth model into the `AuthOptions` shape used to construct the script's `RequestAuth` (called when initializing `pm.request.auth` before a script runs).

### `class RequestAuth extends Property`
- `constructor(options: AuthOptions, parent?: Property)` — throws `Error('invalid auth type ${options.type}')` if `options.type` isn't a recognized type. Populates an internal `Map<string, VariableList<Variable>>` (`authOptions`) with one entry per auth-type key present in `options` (so if you pass an `AuthOptions` with only `type: 'basic'` and `basic: [...]`, only the `'basic'` entry is populated — other types are simply absent from the map, not defaulted).
- `static isValidType(authType: string): boolean` — checks membership in `AuthTypes`.
- `clear(type: string): void` — removes the stored options for `type` from the internal map (no-op, silently, if `type` is invalid).
- `parameters(): VariableList<Variable> | undefined` — returns the `VariableList` of options for the *currently active* `type` (i.e. whatever `this.type` is set to), or `undefined` if nothing is stored for that type.
- `toJSON(): AuthOptions` — serializes back to the `AuthOptions` shape. For `type === 'noauth'` or `'netrc'` it returns just `{ type }` with no options array. Otherwise returns `{ type, [type]: <array of {key, value} from the VariableList> }`.
- `update(options: VariableList<Variable> | Variable[] | AuthOptions, type?: AuthOptionTypes): void` — replaces the options for `type` (or the current `this.type` if `type` omitted) and switches `this.type` to it. Throws `Error('no valid RequestAuth options is found')` if no variable list could be derived from `options`.
- `use(type: AuthOptionTypes, options: VariableList<Variable> | Variable[] | AuthOptions): void` — same as `update` but `type` is required; throws `Error('invalid type (...)')` if `type` isn't in `AuthTypes`, and the same "no valid options" error as `update` otherwise. This is the method `Request.authorizeUsing()` calls to switch a request's auth type from a script.

### Internal helper (not exported)
- `rawOptionsToVariables(options, targetType?)` — normalizes the three accepted input shapes (`VariableList<Variable>`, `Variable[]`, or a full `AuthOptions` object) into `VariableList<Variable>[]`. Throws `Error('options is not valid: it must be VariableList<Variable> | Variable[] | object')` if none of the shapes match.

## Script-facing surface
- `pm.request.auth` is a `RequestAuth` instance (constructed in `request.ts` from `options.auth || { type: 'noauth' }`).
- `pm.request.auth.parameters()` — read the currently active auth's key/value options.
- `pm.request.auth.update(newOptions)` — mutate the current auth type's options in place.
- `pm.request.authorizeUsing(type, options)` (on `Request`, in `request.ts`) delegates to `this.auth.use(type, options || { type: 'noauth' })` — this is the documented way scripts switch auth type.
- `pm.request.auth.clear(type)` to drop a stored auth-type's options.
- When a pre-request script finishes, `fromPreRequestAuth(request.auth)` converts the mutated `RequestAuth` back to Insomnia's native `RequestAuthentication`, which is what actually gets sent on the wire (see `request.ts`, `authentication: fromPreRequestAuth(updatedReq.auth)`).

## Gotchas / notable behavior
- **`netrc` is a dead end**: `AuthTypes` includes `'netrc'` and `RequestAuth` will happily accept `type: 'netrc'`, but `fromPreRequestAuth` throws `Error('netrc is not supported yet')` when it sees `type === 'netrc'`, and `toPreRequestAuth` throws `Error('netrc auth is not supported in scripting yet')` for the native `'netrc'` type. So a script that sets `type: 'netrc'` will fail only when Insomnia tries to convert it back, not immediately.
- **`singleToken` is unsupported**: `toPreRequestAuth` throws for native auth type `'singleToken'` — there is no path from this native auth type into the script's `RequestAuth` at all.
- **`edgegrid` has interfaces but no transform**: `EdgegridOptions` and `'edgegrid'` are defined in `AuthOptionTypes`/`AuthTypes`, but neither `fromPreRequestAuth` nor `toPreRequestAuth` has a `case 'edgegrid'` — passing this type through those functions falls into the `default` branch and throws `Error('unknown auth type: ...')`.
- **oauth1 `signatureMethod` restrictions**: `fromPreRequestAuth`'s oauth1 branch only supports `HMAC-SHA1`, `HMAC-SHA256`, `RSA-SHA1`, and `PLAINTEXT`. `HMAC-SHA512`, `RSA-SHA256`, and `RSA-SHA512` are recognized strings but explicitly throw `Error('...unsupported signatureMethod type for oauth1: ...')`.
- **oauth1 `privateKey` is a one-way/unsupported field**: comment in code says "it is not supported in the script side" — it's read but not written back into the native auth model in `toPreRequestAuth`.
- **oauth2 has several fields marked "not supported yet in the script side"**: `tokenPrefix`, `responseType`, `origin` are passed through in `fromPreRequestAuth`/`toPreRequestAuth` for round-tripping but are not meaningfully used elsewhere per the inline comments.
- **hawk loses several fields on the round trip to native Insomnia auth**: `timestamp`, `delegation`, `app`, `nonce`, `user` are commented as "some keys are lost here" in `fromPreRequestAuth`'s hawk branch, and `toPreRequestAuth`'s hawk branch hardcodes them back to empty string / `'false'` since "these fields are not supported in Insomnia side".
- **Booleans are stored as strings internally**: all the `AuthOption`/`OAuth2AuthOption` values are `string`, so booleans like `disabled` are represented as `'true'`/`'false'` strings inside the `VariableList`, and compared with `=== 'true'` when converting back.
- **Constructor does not default missing types**: if you construct `new RequestAuth({ type: 'bearer' })` (no `bearer` key), `parameters()` will return `undefined` immediately — there's no implicit empty array.
- **`update`/`use` fully replace, not merge**: calling `update()`/`use()` replaces the entire options list for a type; it does not merge in partial fields.

## Related
- `properties.ts` — `Property` (base class) and `Variable`/`VariableList` container semantics used to store auth options.
- `variables.ts` — `Variable`, `VariableList` (the underlying storage for each auth type's key/value pairs).
- `request.ts` — constructs `pm.request.auth` from `AuthOptions`, exposes `authorizeUsing()`, and calls `fromPreRequestAuth` when finalizing the request.
- `insomnia.ts` — calls `toPreRequestAuth(rawObj.request.authentication)` to seed `pm.request.auth` before a script runs.
- `insomnia-data` package — source of the native `RequestAuthentication` and `OAuth2ResponseType` types that `fromPreRequestAuth`/`toPreRequestAuth` convert to/from.
