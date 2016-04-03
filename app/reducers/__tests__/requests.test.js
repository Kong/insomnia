jest.unmock('../requests');
jest.unmock('../../constants/actionTypes');

import reducer from '../requests';
import * as types from '../../constants/actionTypes';

describe('Requests Reducer', () => {
  var initialState;
  var request;

  beforeEach(() => {
    initialState = {
      all: [],
      active: null,
      filter: ''
    };

    request = {
      _mode: 'json',
      id: 'req_1234567890',
      created: Date.now(),
      modified: Date.now(),
      name: 'My Request',
      method: 'GET',
      body: '{"foo": "bar"}',
      authentication: {username: 'user', password: 'secret'},
      params: [{name: 'page', value: '3'}],
      headers: [{name: 'Content-Type', value: 'application/json'}]
    };
  });

  it('returns initial state', () => {
    expect(
      reducer(undefined, {})
    ).toEqual(initialState);
  });

  it('returns initial same state with unknown action', () => {
    const state = {foo: 'bar'};
    expect(
      reducer(state, {type: '__INVALID__'})
    ).toBe(state);
  });

  it('should add request', () => {
    expect(
      reducer(undefined, {
        type: types.REQUEST_ADD,
        request: request
      })
    ).toEqual({
      all: [request],
      active: request.id,
      filter: ''
    });
  });

  it('should add request of same name', () => {
    initialState.all.push(request);
    const newRequest = Object.assign({}, request);

    expect(
      reducer(initialState, {
        type: types.REQUEST_ADD,
        request: newRequest
      })
    ).toEqual({
      all: [
        Object.assign(newRequest, {name: `${request.name} (1)`}),
        request
      ],
      active: request.id,
      filter: ''
    });
  });
  
  it('should delete request', () => {
    initialState.all.push(request);
    initialState.active = request.id;

    expect(
      reducer(initialState, {
        type: types.REQUEST_DELETE,
        id: request.id
      })
    ).toEqual({
      all: [],
      active: null,
      filter: ''
    });
  });
  
  it('should delete request and not remove active', () => {
    initialState.all.push(request);
    initialState.active = 'req_9999999999';

    expect(
      reducer(initialState, {
        type: types.REQUEST_DELETE,
        id: request.id
      })
    ).toEqual({
      all: [],
      active: 'req_9999999999',
      filter: ''
    });
  });

  it('should update request', () => {
    const state = reducer(undefined, {
      type: types.REQUEST_ADD,
      request: request
    });

    const patch = {
      id: request.id,
      name: 'New Name'
    };

    expect(reducer(state, {
      type: types.REQUEST_UPDATE,
      patch: patch
    })).toEqual({
      all: [Object.assign({}, request, patch)],
      active: request.id,
      filter: ''
    });
  });

  it('should not update unknown request', () => {
    expect(reducer(initialState, {
      type: types.REQUEST_UPDATE,
      patch: {id: 'req_1234567890123'}
    })).toEqual(initialState);
  });

  it('should activate request', () => {
    initialState.all = [request];
    initialState.active = null;

    expect(reducer(initialState, {
      type: types.REQUEST_ACTIVATE,
      id: request.id
    })).toEqual({
      all: [request],
      active: request.id,
      filter: ''
    });
  });

  it('should not activate invalid request', () => {
    initialState.all = [request];
    initialState.active = null;

    expect(reducer(initialState, {
      type: types.REQUEST_ACTIVATE
    })).toEqual(initialState);
  });
});
