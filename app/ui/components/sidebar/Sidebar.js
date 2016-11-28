import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';
import EnvironmentsDropdown from '../dropdowns/EnvironmentsDropdown';
import SidebarFilter from './SidebarFilter';
import SidebarChildren from './SidebarChildren';
import SyncButton from '../dropdowns/SyncDropdown';
import WorkspaceDropdown from '../dropdowns/WorkspaceDropdown';
import {SIDEBAR_SKINNY_REMS, COLLAPSE_SIDEBAR_REMS} from '../../../common/constants';


class Sidebar extends PureComponent {
  _handleChangeEnvironment = id => {
    const {workspace, handleSetActiveEnvironment} = this.props;
    handleSetActiveEnvironment(workspace._id, id);
  };

  _handleCreateRequestInWorkspace = () => {
    const {workspace, handleCreateRequest} = this.props;
    handleCreateRequest(workspace._id);
  };

  _handleCreateRequestGroupInWorkspace = () => {
    const {workspace, handleCreateRequestGroup} = this.props;
    handleCreateRequestGroup(workspace._id);
  };

  render () {
    const {
      showCookiesModal,
      filter,
      children,
      hidden,
      width,
      workspace,
      workspaces,
      environments,
      activeEnvironment,
      handleSetActiveWorkspace,
      handleImportFile,
      handleExportFile,
      handleChangeFilter,
      isLoading,
      handleCreateRequest,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleGenerateCode,
      handleCreateRequestGroup,
      handleSetRequestGroupCollapsed,
      moveRequest,
      moveRequestGroup,
      handleActivateRequest,
      activeRequest,
    } = this.props;

    return (
      <aside className={classnames('sidebar', {
        'sidebar--hidden': hidden,
        'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
        'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS
      })}>
        <WorkspaceDropdown
          className="sidebar__header"
          activeWorkspace={workspace}
          workspaces={workspaces}
          handleExportFile={handleExportFile}
          handleImportFile={handleImportFile}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
          isLoading={isLoading}
        />

        <div className="sidebar__menu">
          <EnvironmentsDropdown
            handleChangeEnvironment={this._handleChangeEnvironment}
            activeEnvironment={activeEnvironment}
            environments={environments}
            workspace={workspace}
          />
          <button className="btn btn--super-compact" onClick={showCookiesModal}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          onChange={handleChangeFilter}
          requestCreate={this._handleCreateRequestInWorkspace}
          requestGroupCreate={this._handleCreateRequestGroupInWorkspace}
          filter={filter || ''}
        />

        <SidebarChildren
          children={children}
          handleActivateRequest={handleActivateRequest}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          handleDuplicateRequest={handleDuplicateRequest}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleGenerateCode={handleGenerateCode}
          moveRequest={moveRequest}
          moveRequestGroup={moveRequestGroup}
          filter={filter}
          workspace={workspace}
          activeRequest={activeRequest}
        />

        <SyncButton
          className="sidebar__footer"
          key={workspace._id}
          workspace={workspace}
        />
      </aside>
    )
  }
}

Sidebar.propTypes = {
  // Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleChangeFilter: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  handleSetActiveEnvironment: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleDuplicateRequestGroup: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  showEnvironmentsModal: PropTypes.func.isRequired,
  showCookiesModal: PropTypes.func.isRequired,

  // Other
  hidden: PropTypes.bool.isRequired,
  width: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  workspace: PropTypes.object.isRequired,
  children: PropTypes.arrayOf(PropTypes.object).isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequest: PropTypes.object,
  activeEnvironment: PropTypes.object,
};

export default Sidebar;
