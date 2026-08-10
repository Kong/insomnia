# Port legacy sandbox modules into the QuickJS plugin sandbox

## Context

The legacy pre/post-request scripting sandbox (`packages/insomnia/src/scripting/require-interceptor.ts`) hands plugins real host modules — real `node:util`, real `node:buffer`, real npm packages like `moment`/`cheerio` — with a handful of dangerous methods blocked via a `Proxy` denylist. The QuickJS plugin/template-tag sandbox (this directory) deliberately does the opposite: every `require()`-able module is either a pure-JS reimplementation evaluated inside QuickJS's own isolated memory, or (for `crypto` only) a one-way capture of plain synchronous host functions — never a live reference to a real host object. Only `path`, `crypto`, `events`, `uuid`, and `ajv` have been ported so far. This plan ports the remaining legacy modules across, one at a time, onto the sandbox's allowlist-by-construction model, without regressing that security posture.

See `quickjs-legacy-module-porting-DELAYED.md` for modules explicitly excluded from this round and why.

## Scope: 14 modules, in dependency/risk order

`atob`/`btoa` are already implemented (pure-JS globals in `in-sandbox-bootstrap.ts`) — nothing to do.

Resolved by research, not open decisions — folded directly into the relevant milestones below:
- **Vendoring guardrail is a non-issue.** `chai`, `cheerio`, `crypto-js`, `csv-parse`, `es-toolkit`, `moment`, `xml2js` are already real dependencies of `packages/insomnia-scripting-environment`, hoisted into the same npm-workspace install `packages/insomnia`'s `check-sandbox-vendor-guardrail.ts` resolves against (it uses `require.resolve` scoped to `INSOMNIA_ROOT`, which walks the hoisted tree). No new production dependencies need adding anywhere.
- **`url` is smaller than it first looks.** `URL`/`URLSearchParams` already exist as sandbox globals (`sandbox-globals.ts`, a pragmatic WHATWG shim, relative-resolution explicitly out of scope). The `url` module milestone is a thin adapter exposing those globals under `require('url')`, plus a legacy `url.parse()`/`.format()` shim — not a from-scratch build.
- **`crypto-js` is not redundant with the existing `crypto` module** — the host `crypto` factory only covers hashing/HMAC/random; `crypto-js` is the only source of symmetric encryption (AES/DES/RC4). Stays in scope.

| # | Module | Tier | Notes |
|---|--------|------|-------|
| 1 | `assert` | trivial | Pure-JS reimplementation, small surface. |
| 2 | `querystring` | trivial | Pure-JS reimplementation. |
| 3 | `punycode` | trivial | Pure-JS reimplementation (not vendored — avoids a new dependency for a well-known small algorithm). |
| 4 | `buffer` | medium — reduced & documented full replacement | Extend the existing `__mkBuffer` helper (`sandbox-globals.ts`, already has base64/hex/latin1/utf8 en/decode, `Buffer.from`/`alloc`) with `slice`/`concat`/`indexOf`/`compare`/`toString`. Full replacement, not a shim — allowlist-by-construction, no live host `Buffer` reference. Document omitted methods in `PERMISSIONS.md`. |
| 5 | `string_decoder` | easy-medium | Byte-buffering/multi-byte-sequence logic; reuse buffer helpers from #4. |
| 6 | `util` | medium — reduced & documented full replacement | Port `format`, `promisify`, `types.is*` only; skip full `inspect` fidelity. Same allowlist-by-construction rationale as `buffer`. Document gaps in `PERMISSIONS.md`. |
| 7 | `url` | easy-medium | Thin adapter over existing `URL`/`URLSearchParams` globals + legacy `parse`/`format` shim. |
| 8 | `chai` | easy | Heavy-vendored-lib pipeline; already an app dependency (`packages/insomnia/package.json`). |
| 9 | `crypto-js` | easy | Heavy-vendored-lib pipeline. |
| 10 | `csv-parse/lib/sync` | easy-medium | Heavy-vendored-lib pipeline; confirm the bundler resolves v6's `"sync"` conditional export correctly. |
| 11 | `lodash` (backed by `es-toolkit/compat`) | easy | Heavy-vendored-lib pipeline. Review-focus: `merge`/`set`/`template`-style functions have known prototype-pollution shapes elsewhere — the review milestone must specifically probe these. |
| 12 | `xml2js` | medium | Heavy-vendored-lib pipeline. Review-focus: `sax`'s entity handling only recognizes the fixed built-in XML/HTML entity table (no DOCTYPE/external-entity resolution), so XXE looks unreachable — the review milestone must re-verify this against the actually-pinned `sax` version, not assume it from this note. |
| 13 | `cheerio` | medium, sequenced late | Heavy-vendored-lib pipeline; largest dependency tree (`parse5`/`domhandler`/CSS selector engine, ~1.5M unpacked) — bundling effort/size risk, not a flagged security concern. |
| 14 | `moment` | medium/large, sequenced last, go/no-go decided at that milestone | No in-sandbox substitute exists, so delaying outright risks silently breaking legacy plugins doing date formatting — but it's the heaviest candidate (~5.2M unpacked, locale data) and deprecated upstream. Decide port-vs-delay when this milestone is actually picked up, informed by the size-ceiling test result and any evidence of real plugin usage found by then. |

## Conventions (apply to every milestone)

- **Branching:** one branch per module, `feat/QuickJS-module-<module_name>`. The branch contains the implementation, its regression tests, and its parity tests together — not split across branches.
- **PRs:** open to `develop` in draft mode. Title and body short and direct (e.g. `feat(sandbox): add <module> to QuickJS module registry`, 1-2 sentence body) — no verbose descriptions.
- **Comments/test naming:** no adversary-flavored language (no "evil", "attacker", "malicious", etc. — describe the mechanism, e.g. "blocks unsafe allocation" not "prevents attacker heap disclosure"). No meta-references to this plan or milestone numbers in code/test comments — comments state only what a check is protecting against.
- **Test file naming:** name by tested purpose (`<module>.regression.test.ts`, plus the manifest-grant `describe` block in `plugin-tag-sandbox.test.ts`).

## Milestone template (two per module, two different agents)

**Milestone Na — Implement `<module>`** (branch `feat/QuickJS-module-<module>`)
1. Add the module:
   - *Pure-JS reimplementation* (assert, querystring, punycode, buffer, string_decoder, util, url): add a `SandboxModuleDefinition` to `module-registry.ts` (or extend `sandbox-globals.ts`'s existing helpers where applicable, e.g. `__mkBuffer` for buffer).
   - *Heavy vendored npm lib* (chai, crypto-js, csv-parse, lodash, xml2js, cheerio, moment): follow the existing pipeline exactly — pin in `vendored/pkg/package.json`, entry in `sandbox-vendored-libs-list.ts`, `npm run sandbox:vendored:generate -w insomnia`, register in `module-registry.ts` with `heavy: true`, add to `VENDORED_LIB_VERSIONS`, add a size-ceiling assertion in `vendored-libs.test.ts` (same pattern as `AJV_FACTORY_SOURCE.length < 180_000`).
2. Add a manifest-grant `describe` block to `plugin-tag-sandbox.test.ts` following the existing `events` block (require/exercise/deny).
3. Add `<module>.regression.test.ts` containing:
   - Behavioral/API-surface tests exercising the module inside the sandbox (`runTagInSandbox`).
   - Required parity suite: run identical inputs through (a) ground truth — the real npm package via `vi.importActual` for vendored libs (same pattern as `uuid.regression.test.ts`'s `nodeV5`/`nodeV3` byte-for-byte checks), or the real Node builtin (`node:<module>`) for pure-JS reimplementations — and (b) the sandboxed version, asserting identical output. Scope strictly to the surface actually implemented; any gap (e.g. `util.inspect`, `Buffer.write*`) must be a documented, explicit exclusion in `PERMISSIONS.md`, never a silently-skipped test.
   - Module-specific security probes per the review-focus notes in the scope table above, where applicable.
4. Update `PERMISSIONS.md` with the new entry and any documented surface gaps.
5. Open the draft PR per the conventions above.

**Milestone Nb — Security review `<module>`** (fresh agent, no memory of Na's implementation)
1. Run the `sandbox-security-review` skill scoped to the diff on `feat/QuickJS-module-<module>`.
2. Confirm: no live host-object reference leaks out of the factory/bundle; nothing exposes capability beyond what's declared; omitted/blocked methods stay actually unreachable (not just undocumented); the parity suite from Na genuinely asserts value-identical output against real ground truth (a missing or weak parity assertion is itself a finding, not just a style nit).
3. Apply the module-specific review-focus notes from the scope table (lodash prototype pollution, xml2js entity handling, etc.).
4. Disposition:
   - **Patchable within this module's scope** → fix inline, note briefly in the PR description pointing at `SANDBOX-SECURITY-FINDINGS.md` for detail, take the PR out of draft.
   - **Confirmed but requires rework beyond this module** (a structural conflict between the module and the sandbox model) → stop this module's branch, leave the PR in draft, write the finding into `SANDBOX-SECURITY-FINDINGS.md`, flag it for a decision. Other modules' independent branches are unaffected.
   - **Real, not cleanly fixable now, but not a blocker** (e.g. "this specific function could theoretically be used to escape, no clean fix without larger rework") → document in `SANDBOX-SECURITY-FINDINGS.md`'s "Still unfixed" section, note in the PR description, leave that PR in draft; does not block other modules.

## Ordered milestone list

1a/1b `assert` → 2a/2b `querystring` → 3a/3b `punycode` → 4a/4b `buffer` → 5a/5b `string_decoder` → 6a/6b `util` → 7a/7b `url` → 8a/8b `chai` → 9a/9b `crypto-js` → 10a/10b `csv-parse/lib/sync` → 11a/11b `lodash` → 12a/12b `xml2js` → 13a/13b `cheerio` → 14a/14b `moment`.

Independent branches mean milestones can be picked up out of order or in parallel by different agents; the order above is a priority suggestion (easy-to-hard), not a hard gate — except where a milestone's own review (Nb) pauses per the escalation policy, which blocks only that module's branch.

## Verification

- Every module's `<module>.regression.test.ts` must pass, including its parity assertions against real ground truth (`vi.importActual` for vendored libs, `node:<module>` for reimplementations).
- `npm run sandbox:vendored:guardrail -w insomnia` stays green for every heavy vendored lib.
- `sandbox-surface.test.ts`'s "all registered modules resolve" loop and `surface-profiles.test.ts`'s ceiling assertion continue to pass unmodified — both are generic/self-covering for any new `SANDBOX_MODULES` entry.
- `plugin-tag-sandbox.test.ts` has a new manifest-grant `describe` block for the module (hand-written per module — confirmed to NOT auto-cover new entries, unlike the two above).
- `PERMISSIONS.md` lists the new module and any documented surface gaps.
- Run `npm run lint` and `npm run type-check` from repo root on each branch before marking its PR ready.
- The security-review milestone's disposition (patched / escalated / documented-and-deferred) is recorded per the policy above before the PR leaves draft.
