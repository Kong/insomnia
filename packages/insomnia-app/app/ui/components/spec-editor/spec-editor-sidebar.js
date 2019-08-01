// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../../models/workspace';
import WorkspaceDropdown from '../dropdowns/workspace-dropdown';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import VCS from '../../../sync/vcs';
import classnames from 'classnames';
import { COLLAPSE_SIDEBAR_REMS, SIDEBAR_SKINNY_REMS } from '../../../common/constants';
import type { Environment } from '../../../models/environment';

type Props = {|
  activeEnvironment: Environment | null,
  enableSyncBeta: boolean,
  environmentHighlightColorStyle: string,
  handleSetActiveWorkspace: (id: string) => void,
  hidden: boolean,
  hotKeyRegistry: HotKeyRegistry,
  isLoading: boolean,
  unseenWorkspaces: Array<Workspace>,
  vcs: VCS | null,
  width: number,
  workspace: Workspace,
  workspaces: Array<Workspace>,
|};

@autobind
class SpecEditorSidebar extends React.PureComponent<Props> {
  render() {
    const {
      activeEnvironment,
      enableSyncBeta,
      environmentHighlightColorStyle,
      handleSetActiveWorkspace,
      hidden,
      hotKeyRegistry,
      isLoading,
      unseenWorkspaces,
      vcs,
      width,
      workspace,
      workspaces,
    } = this.props;

    return (
      <aside
        className={classnames('sidebar', 'theme--sidebar', {
          'sidebar--hidden': hidden,
          'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
          'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS,
        })}
        style={{
          borderRight:
            activeEnvironment &&
            activeEnvironment.color &&
            environmentHighlightColorStyle === 'sidebar-edge'
              ? '5px solid ' + activeEnvironment.color
              : null,
        }}>
        <WorkspaceDropdown
          className="sidebar__header theme--sidebar__header"
          isLoading={isLoading}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
          workspaces={workspaces}
          unseenWorkspaces={unseenWorkspaces}
          activeWorkspace={workspace}
          hotKeyRegistry={hotKeyRegistry}
          enableSyncBeta={enableSyncBeta}
          vcs={vcs}
        />
      </aside>
    );
  }
}

export default SpecEditorSidebar;
