/**
 * Replace any old IDs found in the specified document fields with their new counterparts
 * from `idMapping`.
 * */
export function replaceIdsInFields<T>(doc: T, fields: (keyof T)[], idMapping: Map<string, string>): Partial<T> {
  const patch: Partial<T> = {};

  for (const field of fields) {
    const value = doc[field];
    if (value === undefined || value === null) {
      continue;
    }

    const serialized = JSON.stringify(value);
    let updated = serialized;

    for (const [oldId, newId] of idMapping) {
      if (updated.includes(oldId)) {
        // Initially:
        // "https://domain/{% response 'body', 'req_1037126270c84bcbb4a243967d44da5e', 'b64::JC51dWlk::46b', 'never', 60 %}"
        // After splitting:
        // ["https://domain/{% response 'body', '", "', 'b64::JC51dWlk::46b', 'never', 60 %}"]
        // After joining:
        // "https://domain/{% response 'body', 'req_newId', 'b64::JC51dWlk::46b', 'never', 60 %}"
        updated = updated.split(oldId).join(newId);
      }
    }

    if (updated !== serialized) {
      patch[field] = JSON.parse(updated) as T[keyof T];
    }
  }

  return patch;
}
