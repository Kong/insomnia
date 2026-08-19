# Shared interfaces (`RequestContext`, `IEnvironment`)

**Source:** `packages/insomnia-scripting-environment/src/objects/interfaces.ts`

## Purpose
Pure type-only file (no runtime code) defining the shared shapes used to pass state into and out
of the scripting environment. `RequestContext` is the full serialized state snapshot that the host
app (`packages/insomnia`) builds before running a script and that `initInsomniaObject` (in
`insomnia.ts`) turns into a live `InsomniaObject`.

## Public API

### `interface IEnvironment`
```ts
interface IEnvironment {
  id: string;
  name: string;
  data: object;
}
```
Minimal serialized shape for any environment-like blob (globals, base globals, environment, base
environment, vault). Marked `/** @ignore */` (excluded from generated public docs).

### `interface RequestContext`
```ts
interface RequestContext {
  request: Request;
  timelinePath: string;
  environment: IEnvironment;
  baseEnvironment: IEnvironment;
  vault?: IEnvironment;
  collectionVariables?: object;
  globals?: IEnvironment;
  baseGlobals?: IEnvironment;
  iterationData?: Omit<IEnvironment, 'id'>;
  timeout: number;
  settings: Settings;
  clientCertificates: ClientCertificate[];
  cookieJar: CookieJar;
  response?: any;
  requestTestResults?: RequestTestResult[];
  requestInfo: RequestInfoOption;
  execution: ExecutionOption;
  logs: string[];
  transientVariables?: Omit<IEnvironment, 'id'>;
  parentFolders: { id: string; name: string; environment: Record<string, any> }[];
}
```
Full input/output snapshot for one script execution. Fields of note:
- `request: Request` — the raw request model (from `insomnia-data`), not the script-facing `ScriptRequest` wrapper in `request.ts`.
- `globals`/`baseGlobals` — optional; per the inline comment, "activated only when selected".
- `iterationData`/`transientVariables` — typed as `Omit<IEnvironment, 'id'>` (no `id` field needed for these).
- `response?: any` — deliberately untyped; comment notes "Callback types defined elsewhere to avoid circular imports".
- `requestInfo: RequestInfoOption` and `execution: ExecutionOption` — imported from `./execution` and `./request-info` respectively; these are the plain-object option shapes consumed by the `Execution`/`RequestInfo` constructors (see `execution.md`/`request-info.md`).
- `parentFolders` — array of plain folder descriptors (`id`, `name`, `environment` data), consumed by `ParentFolders`/`Folder` in `folders.ts`.

Both interfaces are marked `/** @ignore */`, meaning they're internal/plumbing types not meant to
appear in the generated public SDK reference.

## Script-facing surface
None directly. A user's pre-request/after-response/test script never sees a `RequestContext` or
`IEnvironment` value — these are internal transport types used by the host application
(`packages/insomnia/src/scripting/run-script.ts`) to hand state into `initInsomniaObject` and to
receive mutated state back out via `InsomniaObject.toObject()`.

## Gotchas / notable behavior
- `globals`/`baseGlobals`/`vault` are all optional — code reading them elsewhere (e.g.
  `initInsomniaObject`) must handle `undefined` explicitly (it does, via `?.` and fallbacks).
- `response` being typed `any` means no compile-time safety on the response shape passed into the
  scripting environment; the real shape is validated only implicitly by how `toScriptResponse` (in
  `response.ts`) consumes it.
- This file has no runtime exports (interfaces only) — importing it has zero side effects.

## Related
- `insomnia.ts` — `initInsomniaObject(rawObj: RequestContext, log)` is the sole consumer that turns this shape into a live `InsomniaObject`.
- `execution.ts` — supplies `ExecutionOption`, embedded as `RequestContext.execution`.
- `request-info.ts` — supplies `RequestInfoOption`, embedded as `RequestContext.requestInfo`.
- `environments.ts` — `Environment`/`Vault` classes are constructed from `IEnvironment`-shaped data.
- `folders.ts` — `Folder`/`ParentFolders` are constructed from `RequestContext.parentFolders`.
- `packages/insomnia/src/scripting/run-script.ts` — builds and consumes `RequestContext` around each script run.
