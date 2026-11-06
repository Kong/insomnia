import type { OpenAPIV3 } from 'openapi-types';

// openapi-types has no 3.2 types: `query` and `additionalOperations` are new in 3.2, `$ref` is a Path Item field since 3.1
export type PathItemObject = OpenAPIV3.PathItemObject & {
  query?: OpenAPIV3.OperationObject;
  additionalOperations?: Record<string, OpenAPIV3.OperationObject>;
};

export interface PathItemMethod {
  method: string;
  // Key path of the operation in the spec document, used to scroll the editor to it.
  // Kept as segments because path / webhook names can contain dots (e.g. `pet.created`)
  jumpTo: string[];
}

const STANDARD_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'] as const;

const LOCAL_PATH_ITEM_REF = /^#\/components\/pathItems\/([^/]+)$/;

const getOwnMethods = (pathItem: PathItemObject, location: string[]): PathItemMethod[] => [
  ...STANDARD_METHODS.filter(method => pathItem[method]).map(method => ({
    method,
    jumpTo: [...location, method],
  })),
  ...Object.keys(pathItem.additionalOperations || {}).map(method => ({
    method,
    jumpTo: [...location, 'additionalOperations', method],
  })),
];

/**
 * @param location key path of the Path Item in the spec document, e.g. `['paths', '/pets']` or `['webhooks', 'newPet']`
 */
export const getMethodsFromOpenApiPathItem = (
  location: string[],
  pathItem: PathItemObject,
  pathItems?: Record<string, PathItemObject>,
): PathItemMethod[] => {
  const ownMethods = getOwnMethods(pathItem, location);
  if (ownMethods.length > 0 || !pathItem.$ref) {
    return ownMethods;
  }

  // Only local `#/components/pathItems/<name>` references are resolved, and only one level deep
  const name = LOCAL_PATH_ITEM_REF.exec(pathItem.$ref)?.[1];
  const referenced = name ? pathItems?.[name] : undefined;
  return name && referenced ? getOwnMethods(referenced, ['components', 'pathItems', name]) : [];
};
