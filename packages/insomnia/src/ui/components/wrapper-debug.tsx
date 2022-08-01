import React, { FC, Fragment, ReactNode } from 'react';
import { useSelector } from 'react-redux';

import { isGrpcRequest } from '../../models/grpc-request';
import { isRemoteProject } from '../../models/project';
import { Request, RequestHeader } from '../../models/request';
import type { Response } from '../../models/response';
import { isCollection, isDesign } from '../../models/workspace';
import { VCS } from '../../sync/vcs/vcs';
import {
  selectActiveEnvironment,
  selectActiveProject,
  selectActiveRequest,
  selectActiveWorkspace,
  selectIsLoggedIn,
  selectSettings,
} from '../redux/selectors';
import { selectSidebarFilter } from '../redux/sidebar-selectors';
import { EnvironmentsDropdown } from './dropdowns/environments-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { ErrorBoundary } from './error-boundary';
import { showCookiesModal } from './modals/cookies-modal';
import { PageLayout } from './page-layout';
import { GrpcRequestPane } from './panes/grpc-request-pane';
import { GrpcResponsePane } from './panes/grpc-response-pane';
import { RequestPane } from './panes/request-pane';
import { ResponsePane } from './panes/response-pane';
import { SidebarChildren } from './sidebar/sidebar-children';
import { SidebarFilter } from './sidebar/sidebar-filter';
import { WorkspacePageHeader } from './workspace-page-header';
import type { HandleActivityChange } from './wrapper';

interface Props {
  forceRefreshKey: number;
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
  handleSetActiveEnvironment: (id: string | null) => void;
  handleSetActiveResponse: (requestId: string, activeResponse: Response | null) => void;
  handleForceUpdateRequest: (r: Request, patch: Partial<Request>) => Promise<Request>;
  handleForceUpdateRequestHeaders: (r: Request, headers: RequestHeader[]) => Promise<Request>;
  handleImport: Function;
  handleSetResponseFilter: (filter: string) => void;
  handleDuplicateRequest: Function;
  handleUpdateRequestMimeType: (mimeType: string | null) => Promise<Request | null>;
  headerEditorKey: string;
  vcs: VCS | null;
}
export const WrapperDebug: FC<Props> = ({
  forceRefreshKey,
  gitSyncDropdown,
  handleActivityChange,
  handleSetActiveEnvironment,
  handleSetActiveResponse,
  handleForceUpdateRequest,
  handleForceUpdateRequestHeaders,
  handleImport,
  handleSetResponseFilter,
  handleDuplicateRequest,
  handleUpdateRequestMimeType,
  headerEditorKey,
  vcs,
}) => {

  const activeProject = useSelector(selectActiveProject);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);

  const activeWorkspace = useSelector(selectActiveWorkspace);

  const settings = useSelector(selectSettings);
  const sidebarFilter = useSelector(selectSidebarFilter);

  const isTeamSync = isLoggedIn && activeWorkspace && isCollection(activeWorkspace) && isRemoteProject(activeProject) && vcs;

  return (
    <PageLayout
      renderPageHeader={activeWorkspace ?
        <WorkspacePageHeader
          handleActivityChange={handleActivityChange}
          gridRight={isTeamSync ? <SyncDropdown
            workspace={activeWorkspace}
            project={activeProject}
            vcs={vcs}
          /> : isDesign(activeWorkspace) ? gitSyncDropdown : null}
        />
        : null}
      renderPageSidebar={activeWorkspace ? <Fragment>
        <div className="sidebar__menu">
          <EnvironmentsDropdown
            activeEnvironment={activeEnvironment}
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
            handleSetActiveEnvironment={handleSetActiveEnvironment}
            workspace={activeWorkspace}
          />
          <button className="btn btn--super-compact" onClick={showCookiesModal}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          key={`${activeWorkspace._id}::filter`}
          filter={sidebarFilter || ''}
        />

        <SidebarChildren
          handleDuplicateRequest={handleDuplicateRequest}
          filter={sidebarFilter || ''}
        />
      </Fragment>
        : null}
      renderPaneOne={activeWorkspace ?
        <ErrorBoundary showAlert>
          {activeRequest && isGrpcRequest(activeRequest) ?
            <GrpcRequestPane
              activeRequest={activeRequest}
              environmentId={activeEnvironment ? activeEnvironment._id : ''}
              workspaceId={activeWorkspace._id}
              forceRefreshKey={forceRefreshKey}
              settings={settings}
            />
            :
            <RequestPane
              environmentId={activeEnvironment ? activeEnvironment._id : ''}
              forceRefreshCounter={forceRefreshKey}
              forceUpdateRequest={handleForceUpdateRequest}
              forceUpdateRequestHeaders={handleForceUpdateRequestHeaders}
              handleImport={handleImport}
              headerEditorKey={headerEditorKey}
              request={activeRequest}
              settings={settings}
              updateRequestMimeType={handleUpdateRequestMimeType}
              workspace={activeWorkspace}
            />}
        </ErrorBoundary>
        : null}
      renderPaneTwo={
        <ErrorBoundary showAlert>
          {activeRequest && isGrpcRequest(activeRequest) ?
            <GrpcResponsePane
              activeRequest={activeRequest}
              forceRefreshKey={forceRefreshKey}
            />
            :
            <ResponsePane
              handleSetFilter={handleSetResponseFilter}
              request={activeRequest}
              handleSetActiveResponse={handleSetActiveResponse}
            />}
        </ErrorBoundary>}
    />
  );
};

export default WrapperDebug;
