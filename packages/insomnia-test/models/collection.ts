import type { Workspace } from "../../insomnia-data/src/models/workspace";
import { HttpMethod } from "../enums/http-method";
import { LintSeverity } from "../enums/lint-severity";
import { RulesetType } from "../enums/ruleset-type";

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

/** A single lint panel entry — the Spectral rule id, how many occurrences
 * fired it, its full description text (the message following the rule id,
 * e.g. `must have required property "paths"`), its severity, and the
 * "Ln N" reference for each occurrence (one per `count`, in panel order).
 * Read by `WorkspacePage.getLintEntries()`, which expands every entry to
 * collect `lineRefs` — for a cheap, non-expanding read of just the codes,
 * use `WorkspacePage.getLintEntryCodes()` instead. */
export interface LintEntry {
  code: string;
  description: string;
  severity: LintSeverity;
  lineRefs: string[];
}

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

/** A single unit test read back from a suite's Unit tests list — currently
 * only exposes its name, since that's all `WorkspacePage.getUnitTestNames()`
 * recovers from the UI without running it. */
export class UnitTest {
  constructor(readonly name: string) {}
}

/** A test suite read back from the Tests tab's currently selected row
 * (via `WorkspaceFlow.getTestSuite()`), together with every unit test
 * currently listed under it. */
export class TestSuite {
  constructor(
    readonly name: string,
    readonly tests: UnitTest[],
    /** A reference back to the Collection this suite belongs to — the
     * same `Collection` instance if one was passed to `getTestSuite()`,
     * otherwise a bare one carrying just the `name`/`id` needed to re-find
     * it via `WorkspaceFlow.getCollection()`/`.openTests()`. */
    readonly collection: Collection,
  ) {}
}

export class Collection implements Pick<Workspace, "name"> {
  id?: string;

  /** Legacy back-reference: set when this Collection was created/found as
   * a former standalone "Document" workspace (pre-INS-3528). The two are
   * now the same workspace type — nothing branches on this field anymore,
   * it's kept only so tests written against the old model still resolve
   * the right node. */
  documentId?: string;

  /** Read from the spec's own "Info"/"Paths" outline panel — populated by
   * `WorkspaceFlow.getCollectionSpec()`/`.create()`, left `undefined` if
   * the collection has no spec attached (no "Info" section renders). Not
   * set directly; read this instead of building it yourself. */
  specification?: Specification;

  /** The lint panel's settled error/warning counts, fired rule codes, and
   * (via `entries`) each rule's full description text — populated by
   * `WorkspaceFlow.getLintState()`. Not set directly. */
  lint?: {
    errors: number;
    warnings: number;
    entries: LintEntry[];
  };

  /** Whether a custom or the default Spectral ruleset is active — populated
   * by `WorkspaceFlow.getCollectionSpec()`/`.create()`. Not set directly. */
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
     * creation, via `WorkspaceFlow.create()`. Boilerplate-wrapped into
     * Swagger 2.0 JSON when given as a `Specification`; pass a raw string
     * instead (e.g. a hand-built OpenAPI 3.0 payload) to write it verbatim,
     * bypassing that wrapping — needed for anything that isn't
     * Swagger 2.0. Leave undefined for a plain, spec-less collection. */
    readonly spec?: Specification | string,
  ) {}
}
