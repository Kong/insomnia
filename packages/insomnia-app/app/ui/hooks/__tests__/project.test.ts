
import { act, renderHook } from '@testing-library/react-hooks';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { mocked } from 'ts-jest/utils';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { reduxStateForTest } from '../../../__jest__/redux-state-for-test';
import { withReduxStore } from '../../../__jest__/with-redux-store';
import * as models from '../../../models';
import { DEFAULT_PROJECT_ID, Project } from '../../../models/project';
import MemoryDriver from '../../../sync/store/drivers/memory-driver';
import { VCS } from '../../../sync/vcs/vcs';
import { RootState } from '../../redux/modules';
import { useRemoteProjects } from '../project';

jest.mock('../../../sync/vcs/vcs');

const middlewares = [thunk];
const mockStore = configureMockStore<RootState>(middlewares);

const newMockedVcs = () => mocked(new VCS(new MemoryDriver()), true);

describe('useRemoteProjects', () => {
  beforeEach(globalBeforeEach);

  it('should not load teams if VCS is not set', async () => {
    const store = mockStore(await reduxStateForTest());

    const { result } = renderHook(() => useRemoteProjects(), { wrapper: withReduxStore(store) });
    expect(result.current.loading).toBe(false);
  });

  it('should not load teams if not signed in', async () => {
    const store = mockStore(await reduxStateForTest({ isLoggedIn: false }));

    const vcs = newMockedVcs();

    const { result } = renderHook(() => useRemoteProjects(vcs), { wrapper: withReduxStore(store) });
    result.current.refresh();

    expect(vcs.teams).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    await expect(models.project.all()).resolves.toHaveLength(1);
  });

  it('should load teams each time VCS changes', async () => {
    const store = mockStore(await reduxStateForTest({ isLoggedIn: true }));

    const vcs1 = newMockedVcs();
    const vcs2 = newMockedVcs();
    const team1 = { id: 'id1', name: 'team1' };
    const team2 = { id: 'id2', name: 'team2' };
    vcs1.teams.mockResolvedValue([team1]);
    vcs2.teams.mockResolvedValue([team2]);

    const { result, rerender, waitFor } = renderHook((prop: VCS) => useRemoteProjects(prop), { initialProps: vcs1, wrapper: withReduxStore(store) });

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs1.teams).toHaveBeenCalledTimes(1);

    act(() => rerender(vcs2));

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs2.teams).toHaveBeenCalledTimes(1);

    const allProjects = await models.project.all();
    expect(allProjects).toHaveLength(3);
    expect(allProjects).toEqual(expect.arrayContaining([
      expect.objectContaining<Partial<Project>>({
        _id: DEFAULT_PROJECT_ID,
      }),
      expect.objectContaining<Partial<Project>>({
        remoteId: team1.id,
        name: team1.name,
      }),
      expect.objectContaining<Partial<Project>>({
        remoteId: team2.id,
        name: team2.name,
      }),
    ]));
  });

  it('should load teams on refresh', async () => {
    const store = mockStore(await reduxStateForTest({ isLoggedIn: true }));

    const vcs = newMockedVcs();
    vcs.teams.mockResolvedValue([]);

    const { result, waitFor } = renderHook(() => useRemoteProjects(vcs), { wrapper: withReduxStore(store) });

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs.teams).toHaveBeenCalledTimes(1);
    await expect(models.project.all()).resolves.toHaveLength(1);

    const team1 = { id: 'id1', name: 'team1' };
    const team2 = { id: 'id2', name: 'team2' };
    vcs.teams.mockResolvedValue([team1, team2]);

    // Refresh multiple times
    await act(() => result.current.refresh());
    await act(() => result.current.refresh());

    expect(vcs.teams).toHaveBeenCalledTimes(3);

    const allProjects = await models.project.all();
    expect(allProjects).toHaveLength(3);
    expect(allProjects).toEqual(expect.arrayContaining([
      expect.objectContaining<Partial<Project>>({
        _id: DEFAULT_PROJECT_ID,
      }),
      expect.objectContaining<Partial<Project>>({
        remoteId: team1.id,
        name: team1.name,
      }),
      expect.objectContaining<Partial<Project>>({
        remoteId: team2.id,
        name: team2.name,
      }),
    ]));
  });

  it('should load teams on mount if not in incognitoMode', async () => {
    await models.settings.patch({ incognitoMode: false });
    const store = mockStore(await reduxStateForTest({ isLoggedIn: true }));

    const vcs = newMockedVcs();
    vcs.teams.mockResolvedValue([]);

    // Render hook first time
    const { result } = renderHook(() => useRemoteProjects(vcs), { wrapper: withReduxStore(store) });

    // Refresh manually
    await act(() => result.current.refresh());

    // Called twice - once manually and once on mount
    expect(vcs.teams).toHaveBeenCalledTimes(2);
  });

  it('should not load teams on mount if in incognitoMode', async () => {
    // Set up in incognito mode
    await models.settings.patch({ incognitoMode: true });
    const store = mockStore(await reduxStateForTest({ isLoggedIn: true }));

    const vcs = newMockedVcs();
    vcs.teams.mockResolvedValue([]);

    // Render hook first time
    const { result } = renderHook(() => useRemoteProjects(vcs), { wrapper: withReduxStore(store) });

    // Refresh manually
    await act(() => result.current.refresh());

    // Called only once (manually), because load on mount was skipped
    expect(vcs.teams).toHaveBeenCalledTimes(1);
  });

  it('should load teams on mount if incognitoMode goes from on to off', async () => {
    // Set up in incognito mode
    await models.settings.patch({ incognitoMode: true });
    let state = await reduxStateForTest({ isLoggedIn: true });
    const store = mockStore(() => state);

    const vcs = newMockedVcs();
    vcs.teams.mockResolvedValue([]);

    // Render hook first time
    const { result, rerender } = renderHook(() => useRemoteProjects(vcs), { wrapper: withReduxStore(store) });

    // Refresh manually
    await act(() => result.current.refresh());

    // Called only once (manually), because load on mount was skipped
    expect(vcs.teams).toHaveBeenCalledTimes(1);

    // Reset incognito mode and update state
    await models.settings.patch({ incognitoMode: false });
    vcs.teams.mockClear();

    // Force the store to update
    state = await reduxStateForTest({ isLoggedIn: true });
    store.dispatch({ type: 'ANY_ACTION' });

    // Render the hook again with updated redux store
    rerender();

    // Refresh manually
    await act(() => result.current.refresh());

    // Called twice - once manually and once on mount
    expect(vcs.teams).toHaveBeenCalledTimes(2);
  });
});
