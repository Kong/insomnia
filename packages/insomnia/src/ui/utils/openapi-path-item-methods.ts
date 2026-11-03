import type { OpenAPIV3 } from 'openapi-types';

// openapi-types has no 3.2 types: `query` and `additionalOperations` are new in 3.2, `$ref` is a Path Item field since 3.1
export type PathItemObject = OpenAPIV3.PathItemObject & {
  query?: OpenAPIV3.OperationObject;
  additionalOperations?: Record<string, OpenAPIV3.OperationObject>;
};

export interface PathItemMethod {
  method: string;
  // dot-separated path of the operation in the spec document, used to scroll the editor to it
  jumpTo: string;
}

const STANDARD_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'] as const;

const LOCAL_PATH_ITEM_REF = /^#\/components\/pathItems\/([^/]+)$/;

const getOwnMethods = (pathItem: PathItemObject, pathPrefix: string): PathItemMethod[] => [
  ...STANDARD_METHODS.filter(method => pathItem[method]).map(method => ({
    method,
    jumpTo: `${pathPrefix}.${method}`,
  })),
  ...Object.keys(pathItem.additionalOperations || {}).map(method => ({
    method,
    jumpTo: `${pathPrefix}.additionalOperations.${method}`,
  })),
];

export const getMethodsFromOpenApiPathItem = (
  path: string,
  pathItem: PathItemObject,
  pathItems?: Record<string, PathItemObject>,
): PathItemMethod[] => {
  const ownMethods = getOwnMethods(pathItem, `paths.${path}`);
  if (ownMethods.length > 0 || !pathItem.$ref) {
    return ownMethods;
  }

  // Only local `#/components/pathItems/<name>` references are resolved, and only one level deep
  const name = LOCAL_PATH_ITEM_REF.exec(pathItem.$ref)?.[1];
  const referenced = name ? pathItems?.[name] : undefined;
  return referenced ? getOwnMethods(referenced, `components.pathItems.${name}`) : [];
};
