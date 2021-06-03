import { renderHook, act } from '@testing-library/react-hooks';
import { isLoggedIn as _isLoggedIn } from '../../../account/session';
import MemoryDriver from '../../../sync/store/drivers/memory-driver';
import VCS from '../../../sync/vcs';
import { globalBeforeEach } from '../../../__jest__/before-each';
import { useRemoteSpaces } from '../space';
import * as models from '../../../models';

jest.mock('../../../account/session', () => ({
  isLoggedIn: jest.fn(),
}));

jest.mock('../../../sync/vcs');

const isLoggedIn = _isLoggedIn as jest.MockedFunction<typeof _isLoggedIn>;

describe('useRemoteSpaces', () => {
  beforeEach(globalBeforeEach);

  it('should not load teams if VCS is not set', () => {
    const { result } = renderHook(() => useRemoteSpaces());
    expect(result.current.loading).toBe(false);
  });

  it('should not load teams if not signed in', async () => {
    const vcs = new VCS(new MemoryDriver());
    isLoggedIn.mockReturnValue(false);

    const { result } = renderHook(() => useRemoteSpaces(vcs));
    result.current.refresh();

    expect(vcs.teams).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    await expect(models.space.all()).resolves.toHaveLength(0);
  });

  it('should load teams each time VCS changes', async () => {
    isLoggedIn.mockReturnValue(true);

    const vcs1 = new VCS(new MemoryDriver());
    const vcs2 = new VCS(new MemoryDriver());
    (vcs1.teams as jest.MockedFunction<typeof vcs1.teams>).mockResolvedValue([{ id: 'id1', name: 'name' }]);
    (vcs2.teams as jest.MockedFunction<typeof vcs2.teams>).mockResolvedValue([{ id: 'id2', name: 'name' }]);

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

    await expect(models.space.all()).resolves.toHaveLength(2);
  });

  it('should load teams on refresh', async () => {
    isLoggedIn.mockReturnValue(true);

    const vcs = new VCS(new MemoryDriver());
    (vcs.teams as jest.MockedFunction<typeof vcs.teams>).mockResolvedValue([]);

    const { result, waitFor } = renderHook(() => useRemoteSpaces(vcs));

    // Wait for effect
    await waitFor(() => result.current.loading === true);
    await waitFor(() => result.current.loading === false);

    expect(vcs.teams).toHaveBeenCalledTimes(1);
    await expect(models.space.all()).resolves.toHaveLength(0);

    (vcs.teams as jest.MockedFunction<typeof vcs.teams>).mockResolvedValue([{ id: 'id1', name: 'name' }, { id: 'id2', name: 'name' }]);

    await act(() => result.current.refresh());

    expect(vcs.teams).toHaveBeenCalledTimes(2);
    await expect(models.space.all()).resolves.toHaveLength(2);
  });
});
