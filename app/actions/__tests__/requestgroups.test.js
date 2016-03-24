jest.unmock('../requestgroups');
jest.unmock('../global');
jest.unmock('../../constants/global');
jest.unmock('../../constants/actionTypes');
jest.unmock('../../validators/requestgroup');
jest.unmock('jsonschema');
jest.unmock('redux-thunk');
jest.unmock('redux-mock-store');

import * as types from '../../constants/actionTypes';
import validate from '../../validators/requestgroup';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';
import {addRequestGroup} from "../requestgroups";
import {updateRequestGroup} from "../requestgroups";

const mockStore = configureMockStore([thunk]);

describe('RequestGroup Actions', () => {
  it('should add valid group', () => {
    spyOn(Date, 'now').and.returnValue(1000000000000);
  });
});
