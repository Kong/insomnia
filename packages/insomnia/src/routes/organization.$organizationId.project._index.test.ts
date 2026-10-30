/**
 * @vitest-environment jsdom
 */
import React, { act, createElement as h, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type * as ReactRouter from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Route modules use JSX without importing React, which the test transform compiles to `React.createElement`.
(globalThis as { React?: typeof React }).React = React;

const state: {
  startupSync: { isPending: boolean; data?: { initialProjectId?: string } };
  organizationData?: { projects: { _id: string }[] };
} = { startupSync: { isPending: false } };

vi.mock('react-router', async importOriginal => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useParams: () => ({ organizationId: 'org_1' }),
}));
vi.mock('~/ui/hooks/use-query', () => ({
  useServerQuery: () => state.startupSync,
  useDBQuery: () => ({ data: state.organizationData }),
}));
vi.mock('~/ui/hooks/use-organization-storage-rule', () => ({ useOrganizationStorageRule: () => {} }));
vi.mock('~/ui/hooks/use-startup-sync', () => ({ startupSyncQuery: () => ({}) }));
vi.mock('~/common/app-data', () => ({ organizationDataQuery: () => ({}) }));
vi.mock('~/ui/components/error-boundary', () => ({ ErrorBoundary: ({ children }: { children: ReactNode }) => children }));
vi.mock('~/ui/components/panes/no-project-view', () => ({ NoProjectView: () => h('span', { 'data-testid': 'empty' }) }));
// Stands in for the re-read: hands the current organization data to `getRedirectTo`.
vi.mock('~/ui/components/missing-entity-redirect', () => ({
  DelayedLoadingIndicator: () => h('span', { 'data-testid': 'loading' }),
  MissingEntityRedirect: ({ getRedirectTo }: { getRedirectTo: (data: unknown) => string }) =>
    h('span', { 'data-testid': 'redirect' }, getRedirectTo(state.organizationData)),
}));

import Component from './organization.$organizationId.project._index';

let root: Root;
let container: HTMLDivElement;

const render = () => act(() => root.render(h(Component)));
const shown = () => container.querySelector<HTMLElement>('[data-testid]')?.dataset.testid;
const redirectedTo = () => container.querySelector('[data-testid="redirect"]')?.textContent;

describe('empty project view', () => {
  beforeEach(() => {
    state.startupSync = { isPending: false, data: {} };
    state.organizationData = { projects: [] };
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('waits while the startup sync runs, even when projects are cached', () => {
    state.startupSync = { isPending: true };
    state.organizationData = { projects: [{ _id: 'proj_1' }] };
    render();
    expect(shown()).toBe('loading');
  });

  it('waits for the organization data', () => {
    state.organizationData = undefined;
    render();
    expect(shown()).toBe('loading');
  });

  it('shows the empty view when the organization has no projects', () => {
    render();
    expect(shown()).toBe('empty');
  });

  it('leaves through the organization landing once it has projects', () => {
    state.organizationData = { projects: [{ _id: 'proj_1' }] };
    render();
    expect(redirectedTo()).toBe('/organization/org_1');
  });

  it('opens the Drafts project the startup sync created for the first landing', () => {
    state.startupSync = { isPending: false, data: { initialProjectId: 'proj_drafts' } };
    state.organizationData = { projects: [{ _id: 'proj_drafts' }] };
    render();
    expect(redirectedTo()).toBe('/organization/org_1/project/proj_drafts?isExpanded=true');
  });

  it('ignores a created Drafts project that is gone', () => {
    state.startupSync = { isPending: false, data: { initialProjectId: 'proj_drafts' } };
    state.organizationData = { projects: [{ _id: 'proj_1' }] };
    render();
    expect(redirectedTo()).toBe('/organization/org_1');
  });
});
