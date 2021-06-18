import { renderHook, act } from '@testing-library/react-hooks';
import { isLoggedIn as _isLoggedIn } from '../../../account/session';
import MemoryDriver from '../../../sync/store/drivers/memory-driver';
import { VCS } from '../../../sync/vcs/vcs';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { useRemoteSpaces } from '../space';
import * as models from '../../../models';
import { Space } from '../../../models/space';
import { mocked } from 'ts-jest/utils';

jest.mock('../../../account/session', () => ({
  isLoggedIn: jest.fn(),
}));

jest.mock('../../../sync/vcs/vcs');

const isLoggedIn = mocked(_isLoggedIn);

const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

describe('useRemoteSpaces', () => {
  beforeEach(globalBeforeEach);

  it('should not load teams if VCS is not set', () => {
    const { result } = renderHook(() => useRemoteSpaces());
    expect(result.current.loading).toBe(false);
  });

  it('should not load teams if not signed in', async () => {
    const vcs = newMockedVcs();
    isLoggedIn.mockReturnValue(false);

    const { result } = renderHook(() => useRemoteSpaces(vcs));
    result.current.refresh();

    expect(vcs.teams).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    await expect(models.space.all()).resolves.toHaveLength(0);
  });

  it('should load teams each time VCS changes', async () => {
    isLoggedIn.mockReturnValue(true);

    const vcs1 = newMockedVcs();
    const vcs2 = newMockedVcs();
    const team1 = { id: 'id1', name: 'team1' };
    const team2 = { id: 'id2', name: 'team2' };
    vcs1.teams.mockResolvedValue([team1]);
    vcs2.teams.mockResolvedValue([team2]);

    const { result, rerender, waitFor } = renderHook(prop => useRemoteSpaces(prop), { initialProps: vcs1 });

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs1.teams).toHaveBeenCalledTimes(1);

    act(() => rerender(vcs2));

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs2.teams).toHaveBeenCalledTimes(1);

    const allSpaces = await models.space.all();
    expect(allSpaces).toHaveLength(2);
    expect(allSpaces).toEqual(expect.arrayContaining([
      expect.objectContaining<Partial<Space>>({
        remoteId: team1.id,
        name: team1.name,
      }),
      expect.objectContaining<Partial<Space>>({
        remoteId: team2.id,
        name: team2.name,
      }),
    ]));
  });

  it('should load teams on refresh', async () => {
    isLoggedIn.mockReturnValue(true);

    const vcs = newMockedVcs();
    vcs.teams.mockResolvedValue([]);

    const { result, waitFor } = renderHook(() => useRemoteSpaces(vcs));

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs.teams).toHaveBeenCalledTimes(1);
    await expect(models.space.all()).resolves.toHaveLength(0);

    const team1 = { id: 'id1', name: 'team1' };
    const team2 = { id: 'id2', name: 'team2' };
    vcs.teams.mockResolvedValue([team1, team2]);

    // Refresh multiple times
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());

    expect(vcs.teams).toHaveBeenCalledTimes(3);

    const allSpaces = await models.space.all();
    expect(allSpaces).toHaveLength(2);
    expect(allSpaces).toEqual(expect.arrayContaining([
      expect.objectContaining<Partial<Space>>({
        remoteId: team1.id,
        name: team1.name,
      }),
      expect.objectContaining<Partial<Space>>({
        remoteId: team2.id,
        name: team2.name,
      }),
    ]));
  });
});
