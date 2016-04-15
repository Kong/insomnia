jest.unmock('../requestgroups');
jest.unmock('../global');
jest.unmock('../../constants/global');
jest.unmock('../../constants/actionTypes');
jest.unmock('../../validators/requestGroup');

describe('RequestGroup Actions', () => {
  it('should add valid group', () => {
    spyOn(Date, 'now').and.returnValue(1000000000000);
  });
});
