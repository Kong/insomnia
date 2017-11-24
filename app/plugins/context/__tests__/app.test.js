import * as plugin from '../app';
import * as modals from '../../../ui/components/modals';
import {globalBeforeEach} from '../../../__jest__/before-each';

const PLUGIN = {
  name: 'my-plugin',
  version: '1.0.0',
  directory: '/plugins/my-plugin',
  module: {}
};

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('initializes correctly', async () => {
    const result = plugin.init({name: PLUGIN});
    expect(Object.keys(result)).toEqual(['app']);
    expect(Object.keys(result.app).sort()).toEqual([
      'alert',
      'getPath',
      'showSaveDialog'
    ]);
  });
});

describe('app.alert()', () => {
  beforeEach(globalBeforeEach);
  it('shows alert with message', async () => {
    modals.showAlert = jest.fn().mockReturnValue('dummy-return-value');
    const result = plugin.init(PLUGIN);

    // Make sure it returns result of showAlert()
    expect(result.app.alert()).toBe('dummy-return-value');
    expect(result.app.alert('My message')).toBe('dummy-return-value');

    // Make sure it passes correct arguments
    expect(modals.showAlert.mock.calls).toEqual([
      [{message: '', title: 'Plugin my-plugin'}],
      [{message: 'My message', title: 'Plugin my-plugin'}]
    ]);
  });
});
