import { beforeEach, describe, expect, it, vi } from 'vitest';

import { reportDatabaseStartupFailure } from '../database-startup-error';

vi.mock('electron', () => ({ app: { exit: vi.fn() }, dialog: {}, shell: {} }));

describe('reportDatabaseStartupFailure()', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const deps = (responses: number[]) => {
    const queue = [...responses];
    return {
      showMessageBox: vi.fn(async (_options: Electron.MessageBoxOptions) => ({ response: queue.shift() ?? 0 })),
      openPath: vi.fn(async (_path: string) => ''),
      exit: vi.fn(),
    };
  };

  it('names the datastores that failed and the data folder, then exits with an error code', async () => {
    const d = deps([0]);
    const error = new AggregateError([new Error('boom')], 'Failed to load datastores: Request (boom)');

    await reportDatabaseStartupFailure(error, '/data', d);

    expect(d.showMessageBox).toHaveBeenCalledTimes(1);
    const options = d.showMessageBox.mock.calls[0][0];
    expect(options.type).toBe('error');
    expect(options.detail).toContain('Failed to load datastores: Request (boom)');
    expect(options.detail).toContain('/data');
    expect(d.exit).toHaveBeenCalledWith(1);
  });

  it('opens the data folder on request and asks again, and exits only on Quit', async () => {
    const d = deps([1, 1, 0]);
    await reportDatabaseStartupFailure(new Error('x'), '/data', d);

    expect(d.openPath).toHaveBeenCalledTimes(2);
    expect(d.openPath).toHaveBeenCalledWith('/data');
    expect(d.showMessageBox).toHaveBeenCalledTimes(3);
    expect(d.exit).toHaveBeenCalledTimes(1);
  });

  it('tells the user when the data folder could not be opened, instead of silently showing the dialog again', async () => {
    const d = deps([1, 0]);
    d.openPath.mockResolvedValue('Failed to open path');

    await reportDatabaseStartupFailure(new Error('x'), '/data', d);

    expect(d.showMessageBox.mock.calls[0][0].detail).not.toContain('could not be opened');
    expect(d.showMessageBox.mock.calls[1][0].detail).toContain('The folder could not be opened: Failed to open path');
    expect(console.error).toHaveBeenCalledWith('[main] Could not open the data folder:', 'Failed to open path');
  });

  it('does not mention the folder again once it could be opened', async () => {
    const d = deps([1, 1, 0]);
    d.openPath.mockResolvedValueOnce('Failed to open path').mockResolvedValueOnce('');

    await reportDatabaseStartupFailure(new Error('x'), '/data', d);

    expect(d.showMessageBox.mock.calls[1][0].detail).toContain('could not be opened');
    expect(d.showMessageBox.mock.calls[2][0].detail).not.toContain('could not be opened');
  });

  it('still exits when the dialog itself fails, so no process is left without a window', async () => {
    const d = deps([]);
    d.showMessageBox.mockRejectedValue(new Error('no display'));

    await expect(reportDatabaseStartupFailure(new Error('x'), '/data', d)).rejects.toThrow('no display');
    expect(d.exit).toHaveBeenCalledWith(1);
  });

  it('handles an error that is not an Error object', async () => {
    const d = deps([0]);
    await reportDatabaseStartupFailure('just a string', '/data', d);
    expect(d.showMessageBox.mock.calls[0][0].detail).toContain('just a string');
  });
});
