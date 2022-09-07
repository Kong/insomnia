import { createBuilder } from '@develohpanda/fluent-builder';
import { describe, expect, it } from '@jest/globals';
import { difference } from 'ramda';

import * as models from '../../../models';
import { baseModelSchema, grpcRequestModelSchema, requestGroupModelSchema, requestModelSchema } from '../../../models/__schemas__/model-schemas';
import {
  shouldIgnoreChildrenOf,
  shouldShowInSidebar,
  sortByMetaKeyOrId,
} from '../sidebar-selectors';

const baseModelBuilder = createBuilder(baseModelSchema);
const requestModelBuilder = createBuilder(requestModelSchema);
const requestGroupModelBuilder = createBuilder(requestGroupModelSchema);
const grpcRequestModelBuilder = createBuilder(grpcRequestModelSchema);

describe('shouldShowInSidebar', () => {
  const allTypes = models.types();
  const supported = [models.request.type, models.requestGroup.type, models.grpcRequest.type, models.webSocketRequest.type];
  const unsupported = difference(allTypes, supported);

  it.each(supported)('should show %s in sidebar', type => {
    expect(shouldShowInSidebar(baseModelBuilder.type(type).build())).toBe(true);
  });

  it.each(unsupported)('should not show %s in sidebar', type => {
    expect(shouldShowInSidebar(baseModelBuilder.type(type).build())).toBe(false);
  });
});

describe('shouldIgnoreChildrenOf', () => {
  it('should ignore children of', () => {
    expect(shouldIgnoreChildrenOf(requestModelBuilder.build())).toBe(true);
    expect(shouldIgnoreChildrenOf(grpcRequestModelBuilder.build())).toBe(true);
  });

  it('should not ignore children of', () => {
    expect(shouldIgnoreChildrenOf(requestGroupModelBuilder.build())).toBe(false);
  });
});

describe('sortByMetaKeyOrId', () => {
  it('sort by _id if meta keys are identical', () => {
    const a = requestModelBuilder._id('a').metaSortKey(1).build();
    const b = requestModelBuilder._id('b').metaSortKey(1).build();

    expect(sortByMetaKeyOrId(a, b)).toBe(1);
    expect(sortByMetaKeyOrId(b, a)).toBe(-1);
  });

  it('sort by meta keys', () => {
    const a = requestModelBuilder.metaSortKey(1).build();
    const b = requestModelBuilder.metaSortKey(2).build();

    expect(sortByMetaKeyOrId(a, b)).toBe(-1);
    expect(sortByMetaKeyOrId(b, a)).toBe(1);
  });
});
