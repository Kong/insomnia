import { useMemo } from 'react';

import type { BaseModel } from '~/models';

import { fuzzyMatchAll } from '../../common/misc';
import { isRequestGroup } from '../../models/request-group';

interface SearchableFields {
  name: string;
  description: string;
  url?: string;
  _id: string;
  type: BaseModel['type'];
}

function isMatched(filter: string, doc: SearchableFields): boolean {
  const searchTargets = [
    doc.name,
    doc.description,
    ...(isRequestGroup(doc) ? [] : [doc.url]),
  ]
    .filter(field => field !== null && field !== undefined)
    .map(field => String(field));

  return Boolean(
    fuzzyMatchAll(filter, searchTargets, {
      splitSpace: false,
      loose: true,
    })?.indexes,
  );
}

export function useFilteredRequests<T extends { doc: SearchableFields; ancestors?: string[]; hidden: boolean }>(
  requests: T[],
  filter: string,
): T[] {
  return useMemo(() => {
    if (!filter) {
      return requests;
    }

    const collection = requests.map(node => {
      return {
        ...node,
        hidden: !isMatched(filter, node.doc),
        collapsed: false,
      };
    });
    // If there is a filter then we need to show all the parents of the requests that are not hidden.
    collection.forEach(node => {
      const ancestors = node.ancestors || [];

      if (!node.hidden) {
        ancestors.forEach(ancestorId => {
          const ancestor = collection.find(n => n.doc._id === ancestorId);

          if (ancestor) {
            ancestor.hidden = false;
          }
        });
      }
    });

    return collection;
  }, [requests, filter]);
}
