export interface EncryptedFieldLeaf {
  /** The object or array that holds the value. */
  container: Record<string | number, unknown>;
  key: string | number;
  /** Concrete path of this value inside the document, e.g. `cookies[2].value`. */
  path: string;
}

type Visit = (leaf: EncryptedFieldLeaf) => void;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// `a`, `a[]` or `a[][]`: the key and how many array levels to go through
const parseSegment = (segment: string) => {
  let end = segment.length;
  while (segment.endsWith('[]', end)) {
    end -= 2;
  }
  return { name: segment.slice(0, end), depth: (segment.length - end) / 2 };
};

// Goes `depth` array levels down into `array`, then continues with each element
const walkElements = (
  array: unknown[],
  depth: number,
  arrayPath: string,
  segments: string[],
  index: number,
  visit: Visit,
) => {
  const isLast = index === segments.length - 1;
  array.forEach((element, i) => {
    const elementPath = `${arrayPath}[${i}]`;
    if (depth > 1) {
      if (Array.isArray(element)) {
        walkElements(element, depth - 1, elementPath, segments, index, visit);
      }
    } else if (isLast) {
      visit({ container: array as unknown as Record<number, unknown>, key: i, path: elementPath });
    } else {
      walk(element, segments, index + 1, elementPath, visit);
    }
  });
};

const walk = (node: unknown, segments: string[], index: number, parentPath: string, visit: Visit) => {
  if (!isPlainObject(node)) {
    return;
  }
  const { name, depth } = parseSegment(segments[index]);
  if (!Object.hasOwn(node, name)) {
    return;
  }
  const path = parentPath ? `${parentPath}.${name}` : name;
  const value = node[name];
  if (depth === 0) {
    if (index === segments.length - 1) {
      visit({ container: node, key: name, path });
    } else {
      walk(value, segments, index + 1, path, visit);
    }
    return;
  }
  if (Array.isArray(value)) {
    walkElements(value, depth, path, segments, index, visit);
  }
};

/**
 * Calls `visit` for every value that sits on one of `paths` in `doc`. Path syntax: `a.b` walks object keys, `a[].b` means
 * `b` of every element of the array `a`, and `a[][]` goes through an array of arrays. Anything that does not match the
 * shape (missing key, `null`, wrong container type) is skipped silently, because NeDB does not enforce the schema at runtime.
 */
export const forEachEncryptedLeaf = (doc: unknown, paths: readonly string[], visit: Visit) => {
  for (const path of paths) {
    walk(doc, path.split('.'), 0, '', visit);
  }
};
