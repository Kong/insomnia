jest.unmock('../requestGroups');
jest.unmock('../../constants/actionTypes');

import reducer from '../requestGroups';

describe('RequestGroups Reducer', () => {
  var initialState;
  var requestGroup;

  beforeEach(() => {
    initialState = {
      all: [],
      collapsed: []
    };

    requestGroup = {
      id: 'rg_1234567890',
      created: Date.now(),
      modified: Date.now(),
      name: 'My Group',
      environment: {},
      children: []
    };
  });

  it('returns initial state', () => {
    expect(
      reducer(undefined, {})
    ).toEqual(initialState);
  });
});
