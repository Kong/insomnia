// @flow
import { renderHook } from '@testing-library/react-hooks';
import useProtoFileReload from '../use-proto-file-reload';
import { createBuilder } from '@develohpanda/fluent-builder';
import { requestStateSchema } from '../../../../context/grpc/__schemas__';
import { grpcActions } from '../../../../context/grpc';

jest.mock('../../../../context/grpc');

const requestStateBuilder = createBuilder(requestStateSchema);

describe('useProtoFileReload', () => {
  beforeEach(() => {
    requestStateBuilder.reset();
    jest.resetAllMocks();
  });

  it('should not dispatch anything if methods do not need to be reloaded', () => {
    const state = requestStateBuilder.reloadMethods(false).build();
    const dispatch = jest.fn();

    renderHook(() => useProtoFileReload(state, dispatch, {}));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('should not dispatch anything if the request is running', () => {
    const state = requestStateBuilder
      .reloadMethods(true)
      .running(true)
      .build();
    const dispatch = jest.fn();

    renderHook(() => useProtoFileReload(state, dispatch, {}));

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('should dispatch clear before dispatching loadMethods', () => {
    const state = requestStateBuilder
      .reloadMethods(true)
      .running(false)
      .build();
    const dispatch = jest.fn();
    const r1 = { _id: 'rid', protoFileId: 'pfid' };

    const { rerender } = renderHook(request => useProtoFileReload(state, dispatch, request), {
      initialProps: r1,
    });

    expect(grpcActions.clear).toHaveBeenCalledWith(r1._id);
    expect(grpcActions.loadMethods).toHaveBeenCalledWith(r1._id, r1.protoFileId);

    setTimeout(() => {
      expect(dispatch).toHaveBeenCalledTimes(2);
    }, 100);

    // Should re-run after id changes
    jest.clearAllMocks();
    const r2 = { _id: 'new-rid', protoFileId: 'pfid' };
    rerender(r2);

    expect(grpcActions.clear).toHaveBeenCalledWith(r2._id);
    expect(grpcActions.loadMethods).toHaveBeenCalledWith(r2._id, r2.protoFileId);

    setTimeout(() => {
      expect(dispatch).toHaveBeenCalledTimes(2);
    }, 100);

    // Should re-run after protoFile id changes
    jest.clearAllMocks();
    const r3 = { _id: 'rid', protoFileId: 'new-pfid' };
    rerender(r3);

    expect(grpcActions.clear).toHaveBeenCalledWith(r3._id);
    expect(grpcActions.loadMethods).toHaveBeenCalledWith(r3._id, r3.protoFileId);

    setTimeout(() => {
      expect(dispatch).toHaveBeenCalledTimes(2);
    }, 100);
  });
});
