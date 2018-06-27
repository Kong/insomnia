import * as plugin from '../app';
import * as modals from '../../../ui/components/modals';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { RENDER_PURPOSE_SEND } from '../../../common/render';

describe('init()', () => {
  beforeEach(globalBeforeEach);
  it('initializes correctly', async () => {
    const result = plugin.init();
    expect(Object.keys(result)).toEqual(['app']);
    expect(Object.keys(result.app).sort()).toEqual([
      'alert',
      'getPath',
      'prompt',
      'showSaveDialog'
    ]);
  });
});

describe('app.alert()', () => {
  beforeEach(globalBeforeEach);
  it('does not show alert when not sending', async () => {
    modals.showAlert = jest.fn();
    const result = plugin.init();

    result.app.alert();

    // Make sure it passes correct arguments
    expect(modals.showAlert.mock.calls).toEqual([]);
  });

  it('shows alert with message when sending', async () => {
    modals.showAlert = jest.fn().mockReturnValue('dummy-return-value');
    const result = plugin.init(RENDER_PURPOSE_SEND);

    // Make sure it returns result of showAlert()
    expect(result.app.alert('Title')).toBe('dummy-return-value');
    expect(result.app.alert('Title', 'Message')).toBe('dummy-return-value');

    // Make sure it passes correct arguments
    expect(modals.showAlert.mock.calls).toEqual([
      [{ title: 'Title' }],
      [{ title: 'Title', message: 'Message' }]
    ]);
  });
});

describe('app.prompt()', () => {
  beforeEach(globalBeforeEach);
  it('does not show prompt when not sending', async () => {
    modals.showPrompt = jest.fn();
    const result = plugin.init();

    result.app.prompt();

    // Make sure it passes correct arguments
    expect(modals.showPrompt.mock.calls).toEqual([]);
  });

  it('shows alert with message when sending', async () => {
    modals.showPrompt = jest.fn();
    const result = plugin.init(RENDER_PURPOSE_SEND);

    // Make sure it returns result of showAlert()
    result.app.prompt('Title');
    result.app.prompt('Title', { label: 'Label' });

    // Make sure it passes correct arguments
    expect(modals.showPrompt.mock.calls).toEqual([
      [
        {
          title: 'Title',
          onComplete: expect.any(Function),
          onCancel: expect.any(Function)
        }
      ],
      [
        {
          title: 'Title',
          label: 'Label',
          onComplete: expect.any(Function),
          onCancel: expect.any(Function)
        }
      ]
    ]);
  });
});
