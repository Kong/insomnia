import * as models from '../../../models';
import {
  shouldIgnoreChildrenOf,
  shouldShowInSidebar,
  sortByMetaKeyOrId,
} from '../sidebar-selectors';
import { difference } from 'lodash';

describe('shouldShowInSidebar', () => {
  const allTypes = models.types();
  const supported = [models.request.type, models.requestGroup.type, models.grpcRequest.type];
  const unsupported = difference(allTypes, supported);

  it.each(supported)('should show %s in sidebar', type => {
    expect(shouldShowInSidebar({ type })).toBe(true);
  });

  it.each(unsupported)('should not show %s in sidebar', type => {
    expect(shouldShowInSidebar({ type })).toBe(false);
  });
});

describe('shouldIgnoreChildrenOf', () => {
  it.each([models.request.type, models.grpcRequest.type])('should ignore children of %s', type => {
    expect(shouldIgnoreChildrenOf({ type })).toBe(true);
  });

  it.each([models.requestGroup.type])('should not ignore children of', type => {
    expect(shouldIgnoreChildrenOf({ type })).toBe(false);
  });
});

describe('sortByMetaKeyOrId', () => {
  it('sort by _id if meta keys are identical', () => {
    const a = { _id: 'a', metaSortKey: '1' };
    const b = { _id: 'b', metaSortKey: '1' };
    expect(sortByMetaKeyOrId(a, b)).toBe(1);
    expect(sortByMetaKeyOrId(b, a)).toBe(-1);
  });

  it('sort by meta keys', () => {
    const a = { metaSortKey: '1' };
    const b = { metaSortKey: '2' };
    expect(sortByMetaKeyOrId(a, b)).toBe(-1);
    expect(sortByMetaKeyOrId(b, a)).toBe(1);
  });
});
