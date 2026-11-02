export interface EncryptedFieldLeaf {
  /** The object or array that holds the value. */
  container: Record<string | number, unknown>;
  key: string | number;
  /** Concrete path of this value inside the document, e.g. `cookies[2].value`. */
  path: string;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const walk = (
  node: unknown,
  segments: string[],
  index: number,
  parentPath: string,
  visit: (leaf: EncryptedFieldLeaf) => void,
) => {
  if (!isPlainObject(node)) {
    return;
  }
  const segment = segments[index];
  const isArray = segment.endsWith('[]');
  const name = isArray ? segment.slice(0, -2) : segment;
  if (!Object.hasOwn(node, name)) {
    return;
  }
  const path = parentPath ? `${parentPath}.${name}` : name;
  const isLast = index === segments.length - 1;
  const value = node[name];
  if (!isArray) {
    if (isLast) {
      visit({ container: node, key: name, path });
    } else {
      walk(value, segments, index + 1, path, visit);
    }
    return;
  }
  if (!Array.isArray(value)) {
    return;
  }
  value.forEach((element, i) => {
    const elementPath = `${path}[${i}]`;
    if (isLast) {
      visit({ container: value as unknown as Record<number, unknown>, key: i, path: elementPath });
    } else {
      walk(element, segments, index + 1, elementPath, visit);
    }
  });
};

/**
 * Calls `visit` for every value that sits on one of `paths` in `doc`. Path syntax: `a.b` walks object keys and
 * `a[].b` means `b` of every element of the array `a`. Anything that does not match the shape (missing key, `null`, wrong
 * container type) is skipped silently, because NeDB does not enforce the schema at runtime.
 */
export const forEachEncryptedLeaf = (
  doc: unknown,
  paths: readonly string[],
  visit: (leaf: EncryptedFieldLeaf) => void,
) => {
  for (const path of paths) {
    walk(doc, path.split('.'), 0, '', visit);
  }
};
