
import { act, renderHook } from '@testing-library/react-hooks';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../__jest__/with-redux-store';
import * as models from '../../../models';
import { BASE_PROJECT_ID, Space } from '../../../models/project';
import MemoryDriver from '../../../sync/store/drivers/memory-driver';
import { VCS } from '../../../sync/vcs/vcs';
import { RootState } from '../../redux/modules';
import { useRemoteSpaces } from '../project';

jest.mock('../../../sync/vcs/vcs');

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

describe('useRemoteSpaces', () => {
  beforeEach(globalBeforeEach);

  it('should not load teams if VCS is not set', async () => {
    const store = mockStore(await reduxStateForTest());

    const { result } = renderHook(() => useRemoteSpaces(), { wrapper: withReduxStore(store) });
    expect(result.current.loading).toBe(false);
  });

  it('should not load teams if not signed in', async () => {
    const store = mockStore(await reduxStateForTest({ isLoggedIn: false }));

    const vcs = newMockedVcs();

    const { result } = renderHook(() => useRemoteSpaces(vcs), { wrapper: withReduxStore(store) });
    result.current.refresh();

    expect(vcs.teams).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    await expect(models.space.all()).resolves.toHaveLength(1);
  });

  it('should load teams each time VCS changes', async () => {
    const store = mockStore(await reduxStateForTest({ isLoggedIn: true }));

    const vcs1 = newMockedVcs();
    const vcs2 = newMockedVcs();
    const team1 = { id: 'id1', name: 'team1' };
    const team2 = { id: 'id2', name: 'team2' };
    vcs1.teams.mockResolvedValue([team1]);
    vcs2.teams.mockResolvedValue([team2]);

    const { result, rerender, waitFor } = renderHook((prop: VCS) => useRemoteSpaces(prop), { initialProps: vcs1, wrapper: withReduxStore(store) });

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
    expect(allSpaces).toHaveLength(3);
    expect(allSpaces).toEqual(expect.arrayContaining([
      expect.objectContaining<Partial<Space>>({
        _id: BASE_PROJECT_ID,
      }),
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
    const store = mockStore(await reduxStateForTest({ isLoggedIn: true }));

    const vcs = newMockedVcs();
    vcs.teams.mockResolvedValue([]);

    const { result, waitFor } = renderHook(() => useRemoteSpaces(vcs), { wrapper: withReduxStore(store) });

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs.teams).toHaveBeenCalledTimes(1);
    await expect(models.space.all()).resolves.toHaveLength(1);

    const team1 = { id: 'id1', name: 'team1' };
    const team2 = { id: 'id2', name: 'team2' };
    vcs.teams.mockResolvedValue([team1, team2]);

    // Refresh multiple times
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());

    expect(vcs.teams).toHaveBeenCalledTimes(3);

    const allSpaces = await models.space.all();
    expect(allSpaces).toHaveLength(3);
    expect(allSpaces).toEqual(expect.arrayContaining([
      expect.objectContaining<Partial<Space>>({
        _id: BASE_PROJECT_ID,
      }),
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
