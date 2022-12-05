import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { Route, Routes, useParams } from 'react-router-dom';

import { EnvironmentsDropdown } from '../components/dropdowns/environments-dropdown';
import { showCookiesModal } from '../components/modals/cookies-modal';
import { PlaceholderResponsePane } from '../components/panes/placeholder-response-pane';
import { SidebarChildren } from '../components/sidebar/sidebar-children';
import { SidebarFilter } from '../components/sidebar/sidebar-filter';
import { SidebarLayout } from '../components/sidebar-layout';
import {
  selectActiveEnvironment,
} from '../redux/selectors';
import { selectSidebarFilter } from '../redux/sidebar-selectors';
import RequestRoute from './request';

export const DebugSidebar: FC = () => {
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const sidebarFilter = useSelector(selectSidebarFilter);

  const { workspaceId } = useParams() as { workspaceId: string };

  return (
    <SidebarLayout
      renderPageSidebar={
        <>
          <div className="sidebar__menu">
            <EnvironmentsDropdown
              activeEnvironment={activeEnvironment}
              workspaceId={workspaceId}
            />
            <button className="btn btn--super-compact" onClick={showCookiesModal}>
              <div className="sidebar__menu__thing">
                <span>Cookies</span>
              </div>
            </button>
          </div>

          <SidebarFilter
            key={`${workspaceId}::filter`}
            filter={sidebarFilter || ''}
          />

          <SidebarChildren
            filter={sidebarFilter || ''}
          />
        </>}
      renderPaneOne={
        <Routes>
          <Route errorElement={<div>error</div>} path="request/:requestId/*" element={<RequestRoute />} />
        </Routes>}
      renderPaneTwo={
        <Routes>
          <Route errorElement={<div>error</div>} path="request/:requestId/response/*" element={<PlaceholderResponsePane />} />
          {/* <Route errorElement={<div>error</div>} path="request/:requestId/response/:responseId" element={} /> */}
        </Routes>}
    />
  );
};

export default DebugSidebar;
