jest.unmock('../requests');
jest.unmock('../global');
jest.unmock('../../constants/global');
jest.unmock('../../constants/actionTypes');
jest.unmock('../../validators/request');
jest.unmock('../../reducers/requests');
jest.unmock('../../reducers/global');
jest.unmock('jsonschema');
jest.unmock('nunjucks');
jest.unmock('redux-thunk');
jest.unmock('redux-mock-store');

// Jest seems to barf when this isn't here
jest.unmock('request');

import * as types from '../../constants/actionTypes'
import validate from '../../validators/request'
import thunk from 'redux-thunk'
import configureMockStore from 'redux-mock-store'
import {addRequest, updateRequest, deleteRequest} from "../requests"

const mockStore = configureMockStore([thunk]);

describe('Requests Actions', () => {
  it('should add valid request', () => {
    spyOn(Date, 'now').and.returnValue(1000000000000);

    const expectedActions = [
      {
        type: types.REQUEST_ADD,
        request: {
          id: 'rq_1000000000000',
          created: 1000000000000,
          modified: 1000000000000,
          name: 'New Request',
          method: 'GET',
          url: '',
          body: '',
          contentType: 'text/plain',
          headers: [],
          params: [],
          authentication: {}
        }
      }
    ];

    const store = mockStore();
    store.dispatch(addRequest());

    const actions = store.getActions();
    expect(actions).toEqual(expectedActions);
    expect(validate(actions[0].request).valid).toEqual(true);
  });

  it('should delete request', () => {
    const expectedActions = [
      {type: types.REQUEST_DELETE, id: 'rq_1000000000000'}
    ];

    const store = mockStore();

    store.dispatch(deleteRequest('rq_1000000000000'));

    const actions = store.getActions();
    expect(actions).toEqual(expectedActions);
  });

  it('should update valid request', () => {
    spyOn(Date, 'now').and.returnValue(1000000000000);

    const expectedActions = [
      {
        type: types.REQUEST_UPDATE,
        patch: {
          method: 'POST',
          id: 'rq_1000000000000',
          modified: 1000000000000
        }
      }
    ];

    const store = mockStore();

    store.dispatch(updateRequest({id: 'rq_1000000000000', method: 'POST'}));

    const actions = store.getActions();
    expect(actions).toEqual(expectedActions);
    expect(validate(actions[0].request).valid).toEqual(true);
  });
});
