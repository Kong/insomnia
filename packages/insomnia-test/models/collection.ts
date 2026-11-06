import type { HttpMethod } from "@package/enums/http-method";
import type { RulesetType } from "@package/enums/ruleset-type";
import type { Workspace } from "insomnia-data";

export class License {
  constructor(
    readonly name: string,
    readonly url?: string,
  ) {}
}

export class Info {
  constructor(
    readonly title: string,
    readonly version: string,
    readonly description?: string,
    readonly license?: License,
  ) {}
}

/** A single path's operations, keyed by lowercase HTTP method — the same
 * shape a real OpenAPI/Swagger `paths.<path>` object uses. */
export type PathItem = Partial<
  Record<
    Lowercase<HttpMethod>,
    {
      operationId?: string;
      description?: string;
      tags?: string[];
      parameters?: {
        name: string;
        in: string;
        required?: boolean;
        type?: string;
      }[];
      responses?: Record<string, { description: string }>;
    }
  >
>;

/** Built by `WorkspacePage.getSpecification()` from the spec's own "Info"/
 * "Paths" outline panel — not the raw spec text: that panel doesn't expose
 * `host`/`basePath`/`schemes` (no "Servers" section for a Swagger 2.0 doc)
 * or the license's url, so neither is available here. Also used as the
 * input type for `Collection.spec` — when authoring one, `paths` entries
 * can carry full operation detail; when read back from the UI, each
 * operation is reduced to an empty object since the outline only exposes
 * path+method. */
export class Specification {
  constructor(
    readonly info: Info,
    readonly paths: Record<string, PathItem>,
  ) {}
}

export class Collection implements Pick<Workspace, "name"> {
  id?: string;

  /** Read from the spec's own "Info"/"Paths" outline panel — populated by
   * `WorkspaceFlow.getCollectionSpec()`/`.createCollection()`, left `undefined` if
   * the collection has no spec attached (no "Info" section renders). Not
   * set directly; read this instead of building it yourself. */
  specification?: Specification;

  /** Whether a custom or the default Spectral ruleset is active — populated
   * by `WorkspaceFlow.getCollectionSpec()`/`.createCollection()`. Not set directly. */
  rulesetType?: RulesetType;

  /** The "OpenAPI x.y.z" version label shown in the toolbar's left corner
   * (via `WorkspacePage.getOpenApiVersion()`) — populated by
   * `WorkspaceFlow.getCollectionSpec()`. Empty for a Swagger 2.0 spec
   * (which has no `openapi` field) or a collection with no spec. Not set
   * directly. */
  version?: string;

  constructor(
    readonly name: string,
    /** A spec to author into the collection's spec editor right after
     * creation, via `WorkspaceFlow.createCollection()`. Boilerplate-wrapped into
     * Swagger 2.0 JSON when given as a `Specification`; pass a raw string
     * instead (e.g. a hand-built OpenAPI 3.0 payload) to write it verbatim,
     * bypassing that wrapping — needed for anything that isn't
     * Swagger 2.0. Leave undefined for a plain, spec-less collection. */
    readonly spec?: Specification | string,
  ) {}
}
