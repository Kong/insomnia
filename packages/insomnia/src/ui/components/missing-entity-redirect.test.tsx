/**
 * @vitest-environment jsdom
 */
import { QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
const routerState = { isIdle: true };

vi.mock('react-router', () => ({
  Navigate: ({ to }: { to: string }) => <span data-testid="navigate">{to}</span>,
}));
vi.mock('~/ui/utils/router', () => ({ useIsRouterIdle: () => routerState.isIdle }));
vi.mock('~/ui/hooks/use-query', () => ({
  useDBQuery: (options: Parameters<typeof useQuery>[0]) => useQuery(options, queryClient),
}));
vi.mock('~/ui/components/app-loading-indicator', () => ({
  AppLoadingIndicator: () => <span data-testid="loading" />,
}));

import { MissingEntityRedirect } from './missing-entity-redirect';

const fetchProjects = vi.fn<() => Promise<string[]>>();
const projectsQuery = queryOptions({ queryKey: ['projects'], queryFn: () => fetchProjects() });

let root: Root;
let container: HTMLDivElement;

const render = async () => {
  await act(async () => {
    root.render(<MissingEntityRedirect queryOptions={projectsQuery} getRedirectTo={projects => `/${projects[0]}`} />);
  });
};
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? <span data-testid="error">{this.state.error.message}</span> : this.props.children;
  }
}

const navigatedTo = () => container.querySelector('[data-testid="navigate"]')?.textContent ?? null;
const isLoadingShown = () => container.querySelector('[data-testid="loading"]') !== null;

describe('MissingEntityRedirect', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerState.isIdle = true;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('re-reads the cached data before trusting the miss, then redirects based on the fresh data', async () => {
    queryClient.setQueryData(projectsQuery.queryKey, ['stale']);
    fetchProjects.mockResolvedValue(['fresh']);

    await render();
    expect(fetchProjects).toHaveBeenCalledTimes(1);

    await act(() => vi.runAllTimersAsync());
    expect(navigatedTo()).toBe('/fresh');
  });

  it('waits for the router to be idle so an action redirecting by itself wins', async () => {
    queryClient.setQueryData(projectsQuery.queryKey, ['stale']);
    fetchProjects.mockResolvedValue(['fresh']);
    routerState.isIdle = false;

    await render();
    await act(() => vi.runAllTimersAsync());
    expect(navigatedTo()).toBeNull();

    routerState.isIdle = true;
    await render();
    expect(navigatedTo()).toBe('/fresh');
  });

  it('shows the loading indicator only once the re-read takes longer than the delay', async () => {
    queryClient.setQueryData(projectsQuery.queryKey, ['stale']);
    fetchProjects.mockReturnValue(new Promise(() => {}));

    await render();
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(isLoadingShown()).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(150));
    expect(isLoadingShown()).toBe(true);
    expect(navigatedTo()).toBeNull();
  });

  it('hands a failed read without data to the error boundary instead of loading forever', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchProjects.mockRejectedValue(new Error('db read failed'));

    await act(async () => {
      root.render(
        <ErrorBoundary>
          <MissingEntityRedirect queryOptions={projectsQuery} getRedirectTo={projects => `/${projects[0]}`} />
        </ErrorBoundary>,
      );
    });
    await act(() => vi.runAllTimersAsync());

    expect(container.querySelector('[data-testid="error"]')?.textContent).toBe('db read failed');
    expect(navigatedTo()).toBeNull();
  });
});
