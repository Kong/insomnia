import * as app from '../app';
import * as modals from '../../../ui/components/modals';

describe('init()', () => {
  it('does it', () => {
    const plugin = app.init('plugin-name');
    expect(Object.keys(plugin)).toEqual(['app']);
    expect(Object.keys(plugin.app)).toEqual(['alert', 'getPath']);
  });
});

describe('app.alert()', () => {
  it('shows alert with message', async () => {
    modals.showAlert = jest.fn().mockReturnValue('dummy-return-value');
    const plugin = app.init('plugin-name');

    // Make sure it returns result of showAlert()
    expect(plugin.app.alert()).toBeInstanceOf('dummy-return-value');
    expect(plugin.app.alert('My message')).toBeInstanceOf('dummy-return-value');

    // Make sure it passes correct arguments
    expect(modals.showAlert.mock.calls).toEqual([[
      {message: '', title: 'Plugin plugin-name'},
      {message: 'My message', title: 'Plugin plugin-name'}
    ]]);
  });
});
