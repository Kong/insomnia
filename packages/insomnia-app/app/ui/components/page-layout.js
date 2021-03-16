// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { WrapperProps } from './wrapper';
import classnames from 'classnames';
import ErrorBoundary from './error-boundary';
import Sidebar from './sidebar/sidebar';
import { isInsomnia } from '../../common/constants';

type Props = {
  wrapperProps: WrapperProps,

  // Render props
  renderPageSidebar?: () => React.Node,
  renderPageHeader?: () => React.Node,
  renderPageBody?: () => React.Node,
};

type State = {};

@autobind
class PageLayout extends React.PureComponent<Props, State> {
  // Special request updaters
  _handleStartDragSidebar(e: Event): void {
    e.preventDefault();

    const { handleStartDragSidebar } = this.props.wrapperProps;
    handleStartDragSidebar();
  }

  render() {
    const { renderPageBody, renderPageHeader, renderPageSidebar, wrapperProps } = this.props;

    const {
      activity,
      activeEnvironment,
      activeGitRepository,
      activeWorkspace,
      gitVCS,
      handleInitializeEntities,
      handleResetDragSidebar,
      handleSetActiveEnvironment,
      handleSetActiveWorkspace,
      handleSetSidebarRef,
      handleShowSettingsModal,
      isLoading,
      paneHeight,
      paneWidth,
      settings,
      sidebarHidden,
      sidebarWidth,
      syncItems,
      unseenWorkspaces,
      vcs,
      workspaces,
    } = wrapperProps;

    const realSidebarWidth = sidebarHidden ? 0 : sidebarWidth;

    const gridRows = `auto minmax(0, ${paneHeight}fr) 0 minmax(0, ${1 - paneHeight}fr)`;
    const gridColumns =
      `auto ${realSidebarWidth}rem 0 ` +
      `minmax(0, ${paneWidth}fr) 0 minmax(0, ${1 - paneWidth}fr)`;

    return (
      <div
        key="wrapper"
        id="wrapper"
        className={classnames('wrapper', { 'wrapper--vertical': settings.forceVerticalLayout })}
        style={{
          gridTemplateColumns: gridColumns,
          gridTemplateRows: gridRows,
          boxSizing: 'border-box',
          borderTop:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-top'
              ? '5px solid ' + activeEnvironment.color
              : null,
          borderBottom:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-bottom'
              ? '5px solid ' + activeEnvironment.color
              : null,
          borderLeft:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-left'
              ? '5px solid ' + activeEnvironment.color
              : null,
          borderRight:
            activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-right'
              ? '5px solid ' + activeEnvironment.color
              : null,
        }}>
        {renderPageHeader && <ErrorBoundary showAlert>{renderPageHeader()}</ErrorBoundary>}

        {renderPageSidebar && (
          <ErrorBoundary showAlert>
            <Sidebar
              ref={handleSetSidebarRef}
              activeEnvironment={activeEnvironment}
              activeGitRepository={activeGitRepository}
              enableSyncBeta={settings.enableSyncBeta}
              environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
              handleInitializeEntities={handleInitializeEntities}
              handleSetActiveEnvironment={handleSetActiveEnvironment}
              handleSetActiveWorkspace={handleSetActiveWorkspace}
              hidden={sidebarHidden || false}
              hotKeyRegistry={settings.hotKeyRegistry}
              isLoading={isLoading}
              showEnvironmentsModal={this._handleShowEnvironmentsModal}
              syncItems={syncItems}
              unseenWorkspaces={unseenWorkspaces}
              vcs={vcs}
              gitVCS={gitVCS}
              width={sidebarWidth}
              workspace={activeWorkspace}
              workspaces={workspaces}>
              {renderPageSidebar()}
              {!isInsomnia(activity) && (
                <div className="sidebar__footer">
                  <button
                    className="btn btn--compact wide row-spaced"
                    onClick={handleShowSettingsModal}>
                    Preferences <i className="fa fa-gear" />
                  </button>
                </div>
              )}
            </Sidebar>

            <div className="drag drag--sidebar">
              <div
                onDoubleClick={handleResetDragSidebar}
                onMouseDown={this._handleStartDragSidebar}
              />
            </div>
          </ErrorBoundary>
        )}

        {renderPageBody && <ErrorBoundary showAlert>{renderPageBody()}</ErrorBoundary>}
      </div>
    );
  }
}

export default PageLayout;
