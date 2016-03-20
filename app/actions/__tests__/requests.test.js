jest.unmock('../requests');
jest.unmock('../global');
jest.unmock('../../constants/global');
jest.unmock('../../constants/actionTypes');
jest.unmock('../../validators/request');
jest.unmock('jsonschema');
jest.unmock('redux-thunk');
jest.unmock('redux-mock-store');

import * as types from '../../constants/actionTypes';
import validate from '../../validators/request';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import {addRequest} from "../requests";
import {updateRequest} from "../requests";

const mockStore = configureMockStore([thunk]);

describe('Requests Actions', () => {
  it('should add valid request', () => {
    spyOn(Date, 'now').and.returnValue(1000000000000);

    const expectedActions = [
      {type: types.GLOBAL_LOAD_START},
      {
        type: types.REQUEST_ADD,
        request: {
          id: 'rq_1000000000000',
          _mode: 'json',
          created: 1000000000000,
          modified: 1000000000000,
          name: 'Test Request',
          method: 'GET',
          url: '',
          body: '',
          headers: [],
          params: [],
          authentication: {}
        }
      },
      {type: types.GLOBAL_LOAD_STOP}
    ];

    const store = mockStore({});
    store.dispatch(addRequest('Test Request'));
    jest.runAllTimers();

    const actions = store.getActions();
    expect(actions).toEqual(expectedActions);
    expect(validate(actions[1].request).valid).toEqual(true);
  });

  it('should update valid request', () => {
    spyOn(Date, 'now').and.returnValue(1000000000000);

    const expectedActions = [
      {type: types.GLOBAL_LOAD_START},
      {
        type: types.REQUEST_ADD,
        request: {
          id: 'rq_1000000000000',
          _mode: 'json',
          created: 1000000000000,
          modified: 1000000000000,
          url: '',
          name: 'Test Request',
          method: 'GET',
          body: '',
          headers: [],
          params: [],
          authentication: {}
        }
      },
      {type: types.GLOBAL_LOAD_STOP},
      {type: types.GLOBAL_LOAD_START},
      {
        type: types.REQUEST_UPDATE,
        patch: {
          method: 'POST',
          id: 'rq_1000000000000',
          modified: 1000000000000
        }
      },
      {type: types.GLOBAL_LOAD_STOP}
    ];

    const store = mockStore({});
    store.dispatch(addRequest('Test Request'));
    jest.runAllTimers();
    store.dispatch(updateRequest({id: 'rq_1000000000000', method: 'POST'}));
    jest.runAllTimers();

    const actions = store.getActions();
    expect(actions).toEqual(expectedActions);
    expect(validate(actions[1].request).valid).toEqual(true);
  });
});
