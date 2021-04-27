import {
  ascendingNumberSort,
  descendingNumberSort,
  metaSortKeySort,
  sortMethodMap,
} from '../sorting';
import { request, requestGroup, grpcRequest } from '../../models';
import {
  METHOD_DELETE,
  METHOD_GET,
  METHOD_HEAD,
  METHOD_OPTIONS,
  METHOD_PATCH,
  METHOD_POST,
  METHOD_PUT,
  SORT_CREATED_ASC,
  SORT_CREATED_DESC,
  SORT_HTTP_METHOD,
  SORT_NAME_ASC,
  SORT_NAME_DESC,
  SORT_TYPE_ASC,
  SORT_TYPE_DESC,
} from '../constants';

describe('Sorting methods', () => {
  it('sorts by name', () => {
    const ascendingNameSort = sortMethodMap[SORT_NAME_ASC];
    expect(ascendingNameSort({ name: 'a' }, { name: 'b' })).toBe(-1);
    expect(ascendingNameSort({ name: 'b' }, { name: 'a' })).toBe(1);
    expect(ascendingNameSort({ name: 'ab' }, { name: 'abb' })).toBe(-1);
    expect(ascendingNameSort({ name: 'abb' }, { name: 'ab' })).toBe(1);
    expect(ascendingNameSort({ name: 'Abb' }, { name: 'bbb' })).toBe(-1);
    expect(ascendingNameSort({ name: 'bbb' }, { name: 'Abb' })).toBe(1);
    expect(ascendingNameSort({ name: 'abb' }, { name: 'Bbb' })).toBe(-1);
    expect(ascendingNameSort({ name: 'Bbb' }, { name: 'abb' })).toBe(1);
    expect(ascendingNameSort({ name: 'åbb' }, { name: 'bbb' })).toBe(-1);
    expect(ascendingNameSort({ name: 'bbb' }, { name: 'åbb' })).toBe(1);
    expect(ascendingNameSort({ name: 'abcdef' }, { name: 'abcdef' })).toBe(0);

    const descendingNameSort = sortMethodMap[SORT_NAME_DESC];
    expect(descendingNameSort({ name: 'a' }, { name: 'b' })).toBe(1);
    expect(descendingNameSort({ name: 'b' }, { name: 'a' })).toBe(-1);
    expect(descendingNameSort({ name: 'ab' }, { name: 'abb' })).toBe(1);
    expect(descendingNameSort({ name: 'abb' }, { name: 'ab' })).toBe(-1);
    expect(descendingNameSort({ name: 'Abb' }, { name: 'bbb' })).toBe(1);
    expect(descendingNameSort({ name: 'bbb' }, { name: 'Abb' })).toBe(-1);
    expect(descendingNameSort({ name: 'abb' }, { name: 'Bbb' })).toBe(1);
    expect(descendingNameSort({ name: 'Bbb' }, { name: 'abb' })).toBe(-1);
    expect(descendingNameSort({ name: 'åbb' }, { name: 'bbb' })).toBe(1);
    expect(descendingNameSort({ name: 'bbb' }, { name: 'åbb' })).toBe(-1);
    expect(descendingNameSort({ name: 'abcdef' }, { name: 'abcdef' })).toBe(0);
  });

  it('sorts by timestamp', () => {
    const createdFirstSort = sortMethodMap[SORT_CREATED_ASC];
    expect(createdFirstSort({ created: 1000 }, { created: 1100 })).toBe(-1);
    expect(createdFirstSort({ created: 1100 }, { created: 1000 })).toBe(1);
    expect(createdFirstSort({ created: 0 }, { created: 1 })).toBe(-1);
    expect(createdFirstSort({ created: 1 }, { created: 0 })).toBe(1);
    expect(createdFirstSort({ created: 123456789 }, { created: 123456789 })).toBe(0);

    const createdLastSort = sortMethodMap[SORT_CREATED_DESC];
    expect(createdLastSort({ created: 1000 }, { created: 1100 })).toBe(1);
    expect(createdLastSort({ created: 1100 }, { created: 1000 })).toBe(-1);
    expect(createdLastSort({ created: 0 }, { created: 1 })).toBe(1);
    expect(createdLastSort({ created: 1 }, { created: 0 })).toBe(-1);
    expect(createdLastSort({ created: 123456789 }, { created: 123456789 })).toBe(0);
  });

  it('sorts by type', () => {
    const ascendingTypeSort = sortMethodMap[SORT_TYPE_ASC];
    expect(
      ascendingTypeSort(
        { type: request.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(-1);
    expect(
      ascendingTypeSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: request.type, metaSortKey: 2 },
      ),
    ).toBe(1);
    expect(
      ascendingTypeSort(
        { type: request.type, metaSortKey: 2 },
        { type: grpcRequest.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      ascendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 1 },
        { type: request.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      ascendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(-1);
    expect(
      ascendingTypeSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: grpcRequest.type, metaSortKey: 2 },
      ),
    ).toBe(1);
    expect(
      ascendingTypeSort(
        { type: request.type, metaSortKey: 1 },
        { type: request.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      ascendingTypeSort(
        { type: request.type, metaSortKey: 2 },
        { type: request.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      ascendingTypeSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: requestGroup.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      ascendingTypeSort(
        { type: requestGroup.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      ascendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 1 },
        { type: grpcRequest.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      ascendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 2 },
        { type: grpcRequest.type, metaSortKey: 1 },
      ),
    ).toBe(1);

    const descendingTypeSort = sortMethodMap[SORT_TYPE_DESC];
    expect(
      descendingTypeSort(
        { type: request.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      descendingTypeSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: request.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      descendingTypeSort(
        { type: request.type, metaSortKey: 2 },
        { type: grpcRequest.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      descendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 1 },
        { type: request.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      descendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      descendingTypeSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: grpcRequest.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      descendingTypeSort(
        { type: request.type, metaSortKey: 1 },
        { type: request.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      descendingTypeSort(
        { type: request.type, metaSortKey: 2 },
        { type: request.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      descendingTypeSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: requestGroup.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      descendingTypeSort(
        { type: requestGroup.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      descendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 1 },
        { type: grpcRequest.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      descendingTypeSort(
        { type: grpcRequest.type, metaSortKey: 2 },
        { type: grpcRequest.type, metaSortKey: 1 },
      ),
    ).toBe(1);
  });

  it('sorts by HTTP method', () => {
    const httpMethodSort = sortMethodMap[SORT_HTTP_METHOD];
    expect(httpMethodSort({ type: request.type }, { type: requestGroup.type })).toBe(-1);
    expect(httpMethodSort({ type: requestGroup.type }, { type: request.type })).toBe(1);
    expect(httpMethodSort({ type: request.type }, { type: grpcRequest.type })).toBe(-1);
    expect(httpMethodSort({ type: grpcRequest.type }, { type: request.type })).toBe(1);
    expect(httpMethodSort({ type: requestGroup.type }, { type: grpcRequest.type })).toBe(1);
    expect(httpMethodSort({ type: grpcRequest.type }, { type: requestGroup.type })).toBe(-1);
    expect(
      httpMethodSort(
        { type: requestGroup.type, metaSortKey: 1 },
        { type: requestGroup.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: requestGroup.type, metaSortKey: 2 },
        { type: requestGroup.type, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      httpMethodSort(
        { type: grpcRequest.type, metaSortKey: 1 },
        { type: grpcRequest.type, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: grpcRequest.type, metaSortKey: 2 },
        { type: grpcRequest.type, metaSortKey: 1 },
      ),
    ).toBe(1);

    expect(
      httpMethodSort(
        { type: request.type, method: 'CUSTOM_A' },
        { type: request.type, method: 'CUSTOM_B' },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: 'CUSTOM' },
        { type: request.type, method: METHOD_GET },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_GET },
        { type: request.type, method: METHOD_POST },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_POST },
        { type: request.type, method: METHOD_PUT },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_PUT },
        { type: request.type, method: METHOD_PATCH },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_PATCH },
        { type: request.type, method: METHOD_DELETE },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_DELETE },
        { type: request.type, method: METHOD_OPTIONS },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_OPTIONS },
        { type: request.type, method: METHOD_HEAD },
      ),
    ).toBe(-1);

    expect(
      httpMethodSort(
        { type: request.type, method: 'CUSTOM', metaSortKey: 1 },
        { type: request.type, method: 'CUSTOM', metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: 'CUSTOM', metaSortKey: 2 },
        { type: request.type, method: 'CUSTOM', metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_GET, metaSortKey: 1 },
        { type: request.type, method: METHOD_GET, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_GET, metaSortKey: 2 },
        { type: request.type, method: METHOD_GET, metaSortKey: 1 },
      ),
    ).toBe(1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_DELETE, metaSortKey: 1 },
        { type: request.type, method: METHOD_DELETE, metaSortKey: 2 },
      ),
    ).toBe(-1);
    expect(
      httpMethodSort(
        { type: request.type, method: METHOD_DELETE, metaSortKey: 2 },
        { type: request.type, method: METHOD_DELETE, metaSortKey: 1 },
      ),
    ).toBe(1);
  });

  it('sorts by metaSortKey', () => {
    expect(metaSortKeySort({ metaSortKey: 1 }, { metaSortKey: 2 })).toBe(-1);
    expect(metaSortKeySort({ metaSortKey: 2 }, { metaSortKey: 1 })).toBe(1);
    expect(metaSortKeySort({ metaSortKey: -2 }, { metaSortKey: 1 })).toBe(-1);
    expect(metaSortKeySort({ metaSortKey: 1 }, { metaSortKey: -2 })).toBe(1);
    expect(metaSortKeySort({ metaSortKey: 1, _id: 2 }, { metaSortKey: 1, _id: 1 })).toBe(-1);
    expect(metaSortKeySort({ metaSortKey: 1, _id: 1 }, { metaSortKey: 1, _id: 2 })).toBe(1);
  });

  it('sorts by number', () => {
    expect(ascendingNumberSort(1, 2)).toBe(-1);
    expect(ascendingNumberSort(-2, 1)).toBe(-1);
    expect(ascendingNumberSort(2, 1)).toBe(1);
    expect(ascendingNumberSort(1, -2)).toBe(1);

    expect(descendingNumberSort(1, 2)).toBe(1);
    expect(descendingNumberSort(-2, 1)).toBe(1);
    expect(descendingNumberSort(2, 1)).toBe(-1);
    expect(descendingNumberSort(1, -2)).toBe(-1);
  });
});
