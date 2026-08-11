/**
 * @vitest-environment jsdom
 */
import type { FC, PropsWithChildren } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Required for React's `act` to run without warning outside of a
// testing-library-managed environment.
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockNavigate = vi.fn();

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({
    organizationId: 'org_1',
    projectId: 'proj_1',
    workspaceId: 'wrk_1',
  }),
}));

import { InsomniaTabProvider, useInsomniaTabContext } from './insomnia-tab-context';

const requestTab = {
  id: 'req_1',
  type: 'request' as const,
  name: 'Get Widgets',
  url: '/organization/org_1/project/proj_1/workspace/wrk_1/debug/request/req_1',
  organizationId: 'org_1',
  projectId: 'proj_1',
  workspaceId: 'wrk_1',
  projectName: 'My Project',
  workspaceName: 'My Collection',
};

// Minimal renderHook-style harness so this test doesn't need to pull in
// @testing-library/react's DOM utilities just to observe context values.
function renderTabContext() {
  let container: HTMLDivElement | null = document.createElement('div');
  let root: Root | null = createRoot(container);
  const contextRef: { current: ReturnType<typeof useInsomniaTabContext> | null } = { current: null };

  const Consumer: FC = () => {
    contextRef.current = useInsomniaTabContext();
    return null;
  };

  const Wrapper: FC<PropsWithChildren> = ({ children }) => <InsomniaTabProvider>{children}</InsomniaTabProvider>;

  act(() => {
    root?.render(
      <Wrapper>
        <Consumer />
      </Wrapper>,
    );
  });

  return {
    get current() {
      return contextRef.current!;
    },
    unmount: () => {
      act(() => {
        root?.unmount();
      });
      root = null;
      container = null;
    },
  };
}

describe('useInsomniaTabContext > closeTabById', () => {
  let hook: ReturnType<typeof renderTabContext>;

  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockClear();
    hook = renderTabContext();
  });

  afterEach(() => {
    hook.unmount();
  });

  it('navigates to the provided fallbackUrl when closing the only open tab', () => {
    act(() => {
      hook.current.addTab(requestTab);
    });

    const fallbackUrl = '/organization/org_1/project/proj_1/workspace/wrk_1/debug/request-group/fld_1';

    act(() => {
      hook.current.closeTabById('req_1', { fallbackUrl });
    });

    expect(mockNavigate).toHaveBeenCalledWith(fallbackUrl);
    expect(hook.current.currentOrgTabs.tabList).toHaveLength(0);
  });

  it('falls back to the project dashboard when no fallbackUrl is given', () => {
    act(() => {
      hook.current.addTab(requestTab);
    });

    act(() => {
      hook.current.closeTabById('req_1');
    });

    expect(mockNavigate).toHaveBeenCalledWith('/organization/org_1/project/proj_1');
  });

  it('does not use the fallbackUrl when other tabs remain open', () => {
    const otherTab = {
      ...requestTab,
      id: 'req_2',
      url: '/organization/org_1/project/proj_1/workspace/wrk_1/debug/request/req_2',
    };

    act(() => {
      hook.current.addTab(otherTab, { setActive: false });
      hook.current.addTab(requestTab);
    });

    act(() => {
      hook.current.closeTabById('req_1', {
        fallbackUrl: '/organization/org_1/project/proj_1/workspace/wrk_1/debug/request-group/fld_1',
      });
    });

    // closing one of several tabs navigates to the next active tab, not the fallback
    expect(mockNavigate).toHaveBeenCalledWith(otherTab.url);
    expect(hook.current.currentOrgTabs.tabList.map(tab => tab.id)).toEqual(['req_2']);
  });
});
