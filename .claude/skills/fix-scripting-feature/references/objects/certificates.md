# Certificate

**Source:** `packages/insomnia-scripting-environment/src/objects/certificates.ts`

## Purpose
Models a single client (mTLS) certificate for the scripting environment — the script-facing representation surfaced as `pm.request.certificate`. It is deliberately simple: unlike Insomnia's native model (which supports a list of client certificates matched by host), the scripting SDK only ever models **one** certificate per request, matched via `UrlMatchPattern`s (from `urls.ts`).

## Public API

### Types
- `interface SrcRef { src: string }` — a file-path reference; used for `key`, `cert`, and `pfx` since certificate content is loaded from disk, not embedded inline.
- `interface CertificateOptions { name?: string; matches?: string[]; key?: SrcRef; cert?: SrcRef; passphrase?: string; pfx?: SrcRef; disabled?: boolean }` — constructor/`update()` input. `pfx` is documented as "PFX or PKCS12 Certificate".

### `class Certificate extends Property`
- `override _kind = 'Certificate'`
- `override name?: string`
- `matches?: UrlMatchPatternList<UrlMatchPattern>` — constructed internally from the `matches: string[]` option; each string becomes a `UrlMatchPattern`.
- `key?: SrcRef`
- `cert?: SrcRef`
- `passphrase?: string`
- `pfx?: SrcRef`
- `constructor(options: CertificateOptions)` — sets all fields directly from `options`, including `this.disabled = options.disabled` (inherited `Property.disabled` field). `matches` defaults to an empty `UrlMatchPatternList` if `options.matches` is not provided.
- `static isCertificate(obj: object): boolean` — checks `obj._kind === 'Certificate'`.
- `canApplyTo(url: string): boolean` — returns `this.matches ? this.matches.test(url) : false`, i.e. whether any of the certificate's match patterns matches the given URL. Delegates to `UrlMatchPatternList.test()`.
- `update(options: CertificateOptions): void` — fully overwrites `name`, `matches` (rebuilt the same way as in the constructor), `key`, `cert`, `passphrase`, `pfx`. Note: **does not** update `disabled` (unlike the constructor, which does set it) — see Gotchas.

## Script-facing surface
- `pm.request.certificate` is a `Certificate` instance. Per `insomnia.ts`, it's initialized either as an empty placeholder certificate (`name: 'Default Certificate'`, no `key`/`cert`/`pfx`) when the request URL contains unrendered template tags or `filterClientCertificates` returns zero matches, or as `{ name: 'The first matched certificate from Settings', matches: [matchedCertificates[0].host], key: {src: ...}, cert: {src: ...}, passphrase, pfx: {src: ...} }` — built from `matchedCertificates[0]` whenever the match list is **non-empty**, i.e. one or more matches, not only when there's exactly one. If more than one client certificate matches, everything past the first is silently dropped rather than surfaced as the empty-certificate path — a direct consequence of `Certificate` only ever modeling a single certificate (see Gotchas below).
- Scripts can read `pm.request.certificate.key`, `.cert`, `.pfx`, `.passphrase`, `.name`, call `.canApplyTo(url)`, or call `.update({...})` to replace the certificate used for the request. Per `request.ts`, `Request.certificate` is a `Certificate` built the same way (`options.certificate ? new Certificate(options.certificate) : undefined`), and the certificate is serialized back out (`toJSON()`-style plain object with `name`, `matches` stringified, `key`, `cert`, `passphrase`, `pfx`) when the script finishes so Insomnia can merge it into the request's actual client-certificate list via `mergeClientCertificates` (in `request.ts`).

## Gotchas / notable behavior
- **Only one certificate is modeled, even though Insomnia supports several.** `request.ts`'s comment: "Pre-request script request only supports one certificate while Insomnia supports configuring multiple ones." When a script sets a certificate, `mergeClientCertificates` prepends it as a new entry ahead of the request's existing native client certificates rather than replacing the whole list.
- **`update()` does not update `disabled`.** The constructor sets `this.disabled = options.disabled`, but `update()` has no such line — calling `cert.update({ disabled: true, ... })` will not actually change `cert.disabled`. This looks like an inconsistency/bug relative to the constructor's behavior.
- **`cert+key` and `pfx` are mutually exclusive downstream.** `request.ts`'s `mergeClientCertificates` throws `Error('Invalid certificate configuration: "cert+key" and "pfx" can not be set at the same time')` if a script sets both a PFX and a cert/key pair on `pm.request.certificate`.
- **Empty/placeholder certificate is normal, not an error state.** If the request URL contains a template tag (e.g. `{{ baseUrl }}`) or there's no matching client certificate configured in Settings, `pm.request.certificate` is initialized to an empty certificate and `insomnia.ts` logs this via `getExistingConsole().warn(...)` — a warning-level timeline entry, not debug — so it's visible when tracing why the default/empty certificate was selected. Scripts should not assume `key`/`cert`/`pfx` are populated.
- **`matches` is derived only from certificate `host`, singular** — even though `UrlMatchPatternList` supports multiple patterns, `insomnia.ts` only ever seeds `matches: [matchedCertificates[0].host]` (a single-element array) from the native model.

## Related
- `properties.ts` — `Property` base class (provides `id`, `name`, `disabled`, `toJSON()`/`toString()` defaults).
- `urls.ts` — `UrlMatchPattern`, `UrlMatchPatternList` (used for `matches` and `canApplyTo()`).
- `request.ts` — constructs/serializes `pm.request.certificate`, and contains `mergeClientCertificates()` which reconciles the script's single certificate back into Insomnia's native multi-certificate list.
- `insomnia.ts` — seeds the initial `pm.request.certificate` value from Insomnia Settings' configured client certificates, using `filterClientCertificates` from `insomnia/src/network/certificate`.
- `insomnia-data` package — source of the native `ClientCertificate` type.
