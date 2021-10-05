import electron from 'electron';
import { mocked } from 'ts-jest/utils';

import appConfig from '../../../../config/config.json';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { RENDER_PURPOSE_SEND } from '../../../common/render';
import * as modals from '../../../ui/components/modals';
import * as plugin from '../app';

describe('init()', () => {
  beforeEach(globalBeforeEach);

  it('initializes correctly', async () => {
    const result = plugin.init();
    expect(Object.keys(result)).toEqual(['app', '__private']);
    expect(Object.keys(result.app).sort()).toEqual([
      'alert',
      'clipboard',
      'dialog',
      'getPath',
      'getInfo',
      'prompt',
      'showGenericModalDialog',
      'showSaveDialog',
    ].sort());
    expect(Object.keys(result.app.clipboard).sort()).toEqual([
      'clear',
      'readText',
      'writeText',
    ].sort());
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
      [
        {
          title: 'Title',
        },
      ],
      [
        {
          title: 'Title',
          message: 'Message',
        },
      ],
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
    result.app.prompt('Title', {
      label: 'Label',
    });
    // Make sure it passes correct arguments
    expect(modals.showPrompt.mock.calls).toEqual([
      [
        {
          title: 'Title',
          onComplete: expect.any(Function),
          onCancel: expect.any(Function),
          onHide: expect.any(Function),
        },
      ],
      [
        {
          title: 'Title',
          label: 'Label',
          onComplete: expect.any(Function),
          onCancel: expect.any(Function),
          onHide: expect.any(Function),
        },
      ],
    ]);
  });
});

describe('app.getInfo()', () => {
  beforeEach(globalBeforeEach);

  it('provides app info', async () => {
    const result = plugin.init();
    expect(result.app.getInfo()).toEqual({
      'version': appConfig.version,
      'platform': process.platform,
    });
  });

});

describe('app.clipboard', () => {
  it('writes to clipboard', () => {
    // Arrange
    const mockedClipboard = mocked(electron.clipboard);
    const context = plugin.init();
    const text = 'abc';

    // Act
    context.app.clipboard.writeText(text);

    // Assert
    expect(mockedClipboard.writeText).toHaveBeenCalledWith(text);
  });

  it('reads from clipboard', () => {
    // Arrange
    const text = 'abc';
    const mockedClipboard = mocked(electron.clipboard);
    mockedClipboard.readText.mockReturnValue(text);
    const context = plugin.init();

    // Act
    const outputText = context.app.clipboard.readText();

    // Assert
    expect(outputText).toBe(text);
    expect(mockedClipboard.readText).toHaveBeenCalled();
  });

  it('clears clipboard', () => {
    // Arrange
    const mockedClipboard = mocked(electron.clipboard);
    const context = plugin.init();

    // Act
    context.app.clipboard.clear();

    // Assert
    expect(mockedClipboard.clear).toHaveBeenCalled();
  });
});
