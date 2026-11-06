/**
 * Marking sensitive fields in a Zod model schema, and deriving from those marks the list of field paths that are encrypted
 * when a document is written to the local database.
 *
 * ## The problem
 *
 * The local database encrypts some fields (passwords, tokens, cookie values, ...) when it writes a document to disk. To do
 * that it must know, for a document of a given type, exactly which paths inside the document hold secrets, e.g.
 * `authentication.password` or `cookies[].value`. A hand-maintained list of paths, kept apart from the model, would drift:
 * someone adds or renames a field and forgets the list, and a secret silently stays plaintext. So instead the secret is
 * marked on the field itself, in the model's schema, and the paths are derived from the schema:
 *
 * ```ts
 * // in a model file
 * password: encrypted(z.string()).optional(),
 *
 * // somewhere else: ['authentication.password', ...]
 * getEncryptedFieldPaths(requestSchema);
 * ```
 *
 * ## How a Zod schema is built (the mental model needed to read this file)
 *
 * A Zod schema is a tree of small schema objects. Every chained call such as `.optional()`, `.default('')` or `.nullable()`
 * does not change the schema it is called on: it creates a **new outer node that holds the old one**. So
 *
 * ```ts
 * z.object({ cookies: z.array(z.object({ value: z.string().optional().default('') })) })
 * ```
 *
 * is the tree
 *
 * ```
 * object
 *  └─ cookies: array
 *               └─ element: object
 *                            └─ value: default
 *                                       └─ optional
 *                                            └─ string
 * ```
 *
 * `encrypted(z.string())` registers the innermost `string` node in a registry (see below). Deriving the paths is then a
 * walk down this tree that remembers the path taken so far (`cookies`, `cookies[]`, `cookies[].value`) and records the path
 * whenever it reaches a registered `string`. The wrappers (`optional`, `default`, ...) are simply walked through.
 *
 * ## Path syntax
 *
 * - `a.b` is the key `b` of the object `a`.
 * - `a[].b` is the key `b` of every element of the array `a`. Arrays of arrays repeat it: `a[][]` is every element of
 *   every element of `a`.
 * - Union options are merged **by field name**, not by which option the data matches. Request `authentication` is a union
 *   of 13 auth types; `authentication.password` is collected from Basic, Digest, NTLM and OAuth2 and appears once. The cost
 *   is that a name that is a secret in one option but harmless in another (Hawk `key` is a secret, API Key auth's `key` is
 *   just a header name) is encrypted in both. That over-encrypts a harmless value, in exchange for a simple path syntax.
 *
 * ## Failing closed
 *
 * The worst outcome is a marked secret that ends up unencrypted without anyone noticing, so whenever the walk meets
 * something it cannot place correctly it throws instead of skipping it:
 *
 * - a marked field that is not a string (the encrypted value format is a string),
 * - a marked field inside a container that has no path syntax (`record`, `map`, `set`, `tuple`, and the `catchall` of an
 *   object, which holds values under arbitrary keys),
 * - a Zod schema type this file has never been taught about (see "Upgrading Zod" below).
 *
 * ## Upgrading Zod
 *
 * The walk reads `schema._zod.def`, the description Zod keeps of every schema node. Its `type` field names the kind of node
 * (`'object'`, `'array'`, `'optional'`, `'string'`, ...) and, depending on the kind, points at the child nodes. Zod
 * documents this structure for library authors, but it is still tied to the Zod version, and new node kinds appear over
 * time (Zod 4.x added `function`, for example). If this file silently treated an unknown kind as "nothing to see here", a
 * marked field wrapped in a new kind of wrapper would be missed and stay plaintext.
 *
 * To rule that out, `visit()` is an exhaustive `switch` over `z.core.$ZodTypes`, the union of every node kind Zod knows.
 * After a Zod upgrade:
 * - a new node kind makes the `default` branch fail `npm run type-check` (`def` is no longer `never`), and the compiler
 *   points at this file. Add a `case` for it: a wrapper that only adds behaviour around one inner schema goes with the other
 *   wrappers, a plain value goes with the leaves, a container goes with the unsupported containers or gets its own case.
 * - renamed or removed fields of a node make the typed accesses (`def.innerType`, `def.shape`, ...) fail to compile.
 * - a kind that exists at runtime but not in the types (types and runtime of different Zod versions) hits the same
 *   `default` branch at runtime and throws.
 * `encrypted-field.test.ts` covers each branch, including an unknown node kind.
 */
import { z } from 'zod/v4';

/**
 * The registry that remembers which schema nodes are marked as encrypted: a side table from schema node to metadata.
 *
 * A dedicated registry is used rather than `.meta()` or Zod's global registry because `z.toJSONSchema()` is used to
 * generate the published insomnia.schema JSON, and anything stored in the global registry would leak into it.
 */
export const encryptedFieldRegistry = z.registry<{ encrypted: true }>();

/**
 * Marks a string field as sensitive: it is encrypted whenever the document is written to the local database.
 *
 * Returns the very same schema, so the TypeScript type of the field and everything inferred from it (`z.infer`) are
 * unchanged. Wrap the string itself and add the other layers around it:
 *
 * ```ts
 * password: encrypted(z.string()).optional(),
 * value: encrypted(z.string()).optional().default(''),
 * ```
 *
 * Marking a wrapper (`encrypted(z.string().optional())`) works too, but only string fields can be marked: anything else
 * makes `getEncryptedFieldPaths()` throw.
 *
 * **Apply `encrypted()` last, to the finished string.** The mark belongs to this one schema node. Wrappers added afterwards
 * (`.optional()`, `.nullable()`, `.default()`, ...) keep the node inside them, so the mark survives. But Zod methods that
 * change the string itself (`.min()`, `.max()`, `.trim()`, `.regex()`, `.check()`, ...) create a *copy* of the node, and the
 * copy is not marked: `encrypted(z.string()).min(1)` is silently NOT encrypted, and nothing can detect it from the
 * schema. Put such methods inside instead:
 *
 * ```ts
 * password: encrypted(z.string().min(1)).optional(), // right
 * password: encrypted(z.string()).min(1).optional(), // wrong: the field stays plaintext
 * ```
 *
 * (`.describe()` and `.meta()` also copy the node, but the copy remembers its original and keeps the mark.) If a path is
 * missing from the path table snapshot after a model change, this is the first thing to check.
 */
export const encrypted = <T extends z.ZodType>(schema: T): T => {
  // `add` is typed against the concrete schema type; the registry only needs the node identity
  encryptedFieldRegistry.add(schema as z.ZodType, { encrypted: true });
  return schema;
};

type Node = z.core.$ZodType;

/** The description of a schema node: a union of all node kinds, discriminated by `type`. */
const getDef = (schema: Node) => (schema as z.core.$ZodTypes)._zod.def;

interface Context {
  /** The result: every path that leads to a marked string. */
  paths: Set<string>;
  /** Lazy schemas currently being expanded, to stop on recursive schemas such as `JsonSchema` (a JSON value contains JSON values). */
  expanding: Set<Node>;
}

/**
 * Walks `schema` and adds the path of every marked string to `context.paths`.
 *
 * @param schema the node being visited
 * @param path the path that led here, e.g. `cookies[]`; `''` at the root
 * @param marked whether a layer above this node was marked: the mark on a wrapper applies to what it wraps
 * @param unsupported whether this node sits inside a container that has no path syntax (record, map, set, tuple, catchall)
 */
const visit = (schema: Node, path: string, marked: boolean, unsupported: boolean, context: Context) => {
  // `get` rather than `has`: a copy made by `.describe()` / `.meta()` points back at the original node, and `get` follows that
  const isMarked = marked || encryptedFieldRegistry.get(schema)?.encrypted === true;
  const def = getDef(schema);
  const location = path === '' ? '(root)' : path;

  if (isMarked && unsupported) {
    throw new Error(`Encrypted field ${location} sits inside a container that has no encrypted path syntax`);
  }

  switch (def.type) {
    // Wrappers: they add behaviour (optional, default value, ...) around one inner schema and do not change where the
    // value sits in the document, so the path stays the same and the walk continues into the inner schema.
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'nonoptional':
    case 'readonly':
    case 'catch':
    case 'success': {
      visit(def.innerType, path, isMarked, unsupported, context);
      return;
    }

    // Several alternatives for the same value: walk all of them with the same path. This is what merges the options by
    // field name (see "Path syntax" at the top).
    case 'union': {
      for (const option of def.options) {
        visit(option, path, isMarked, unsupported, context);
      }
      return;
    }

    // Both sides describe the same value.
    case 'intersection': {
      visit(def.left, path, isMarked, unsupported, context);
      visit(def.right, path, isMarked, unsupported, context);
      return;
    }

    // `a.pipe(b)`: a value goes through `a`, then `b`. A transform (a function) is not a schema for the stored value, so
    // follow the other side: `z.preprocess(fn, schema)` is pipe(transform, schema) and `schema.transform(fn)` is
    // pipe(schema, transform).
    case 'pipe': {
      visit(getDef(def.in).type === 'transform' ? def.out : def.in, path, isMarked, unsupported, context);
      return;
    }

    // A schema that is resolved on demand, used for recursive definitions. A recursive schema contains itself, so a lazy
    // node that is already being expanded further up must not be expanded again, or the walk would never end.
    case 'lazy': {
      if (context.expanding.has(schema)) {
        return;
      }
      context.expanding.add(schema);
      visit(def.getter(), path, isMarked, unsupported, context);
      context.expanding.delete(schema);
      return;
    }

    // An object: every key is a deeper path. Neither an object nor an array can itself be marked, only a string can.
    // The `catchall` (`.catchall(schema)`) describes the values under any other key, which no path can address, so like the
    // unsupported containers below it is walked with `unsupported` set.
    case 'object': {
      if (isMarked) {
        throw new Error(`Encrypted field ${location} must be a string, got ${def.type}`);
      }
      for (const [key, child] of Object.entries(def.shape)) {
        visit(child, path === '' ? key : `${path}.${key}`, false, unsupported, context);
      }
      if (def.catchall) {
        visit(def.catchall, path, false, true, context);
      }
      return;
    }

    // An array: the elements are addressed with `[]`, meaning "every element". An array of arrays gives `[][]`.
    case 'array': {
      if (isMarked) {
        throw new Error(`Encrypted field ${location} must be a string, got ${def.type}`);
      }
      visit(def.element, `${path}[]`, false, unsupported, context);
      return;
    }

    // Containers whose children cannot be addressed by a path (arbitrary keys, a set has no positions, a tuple would need
    // index syntax). They are still walked, with `unsupported` set, so that a marked field hidden inside one makes the
    // walk throw (first check in this function) instead of being missed.
    case 'record':
    case 'map': {
      if (isMarked) {
        throw new Error(`Encrypted field ${location} must be a string, got ${def.type}`);
      }
      visit(def.keyType, path, false, true, context);
      visit(def.valueType, path, false, true, context);
      return;
    }
    case 'set': {
      if (isMarked) {
        throw new Error(`Encrypted field ${location} must be a string, got ${def.type}`);
      }
      visit(def.valueType, path, false, true, context);
      return;
    }
    case 'tuple': {
      if (isMarked) {
        throw new Error(`Encrypted field ${location} must be a string, got ${def.type}`);
      }
      for (const item of def.items) {
        visit(item, path, false, true, context);
      }
      if (def.rest) {
        visit(def.rest, path, false, true, context);
      }
      return;
    }

    // Leaves: plain values with nothing underneath. Only a `string` can be marked. Zod string formats (`z.email()`,
    // `z.uuid()`, ...) are also of type `string`. `promise` holds a schema but describes a value that cannot be stored in a
    // document, and `transform` is a function, so none of them has a path to follow.
    case 'string':
    case 'number':
    case 'bigint':
    case 'boolean':
    case 'date':
    case 'symbol':
    case 'undefined':
    case 'null':
    case 'any':
    case 'unknown':
    case 'never':
    case 'void':
    case 'literal':
    case 'enum':
    case 'template_literal':
    case 'custom':
    case 'transform':
    case 'promise':
    case 'nan':
    case 'file': {
      if (!isMarked) {
        return;
      }
      // The encrypted value format is a string. A marked root (empty path) would not be a field of a document.
      if (def.type !== 'string' || path === '') {
        throw new Error(`Encrypted field ${location} must be a string field of a document, got ${def.type}`);
      }
      context.paths.add(path);
      return;
    }

    // A node kind this file has not been taught about. The `never` assignment makes this a compile error when a Zod
    // upgrade adds a kind to `z.core.$ZodTypes`; the throw covers a kind that only exists at runtime. Either way it must
    // not be skipped: a marked field inside it would silently stay plaintext.
    default: {
      const unknownDef: never = def;
      throw new Error(
        `Cannot derive encrypted fields at ${location}: unsupported Zod schema type "${(unknownDef as { type: string }).type}". ` +
          'Teach getEncryptedFieldPaths() about it in encrypted-field.ts.',
      );
    }
  }
};

/**
 * Derives the encrypted field paths of a model schema from the fields marked with `encrypted()`, e.g.
 * `['authentication.password', 'cookies[].value']`. See the top of this file for the path syntax.
 *
 * The result is sorted and de-duplicated so that it is stable, which keeps the path table snapshot test readable.
 * Throws if a marked field is not a string, cannot be addressed by a path, or the schema contains a node kind this file
 * does not know.
 */
export const getEncryptedFieldPaths = (schema: Node): string[] => {
  const context: Context = { paths: new Set(), expanding: new Set() };
  visit(schema, '', false, false, context);
  return [...context.paths].sort();
};
