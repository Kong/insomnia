// models - export models that define the structure of the data and any related functions such as init, type guards
import * as dbModels from './db-models';

export * from './db-models';

// Type assertion to ensure dbModels has the expected structure
dbModels satisfies Record<
  string,
  {
    type: string;
    name: string;
    prefix: string;
    optionalKeys?: string[];
    canDuplicate: boolean;
    canSync?: boolean;
    init: () => unknown;
    rewriteReferences?: (doc: any, idMapping: Map<string, string>) => any;
  }
>;

export const all = () => Object.values(dbModels);

export const types = () => all().map(model => model.type);
