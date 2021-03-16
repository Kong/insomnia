// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import type { Workspace } from '../../../models/workspace';
import type { Environment } from '../../../models/environment';
import classnames from 'classnames';
import { COLLAPSE_SIDEBAR_REMS, SIDEBAR_SKINNY_REMS } from '../../../common/constants';
import SyncDropdown from '../dropdowns/sync-dropdown';
import SyncLegacyDropdown from '../dropdowns/sync-legacy-dropdown';
import type { StatusCandidate } from '../../../sync/types';
import { isLoggedIn } from '../../../account/session';

type Props = {|
  activeEnvironment: Environment | null,
  children: React.Node,
  enableSyncBeta: boolean,
  environmentHighlightColorStyle: string,
  handleSetActiveEnvironment: Function,
  handleSetActiveWorkspace: Function,
  hidden: boolean,
  hotKeyRegistry: HotKeyRegistry,
  isLoading: boolean,
  showEnvironmentsModal: Function,
  syncItems: Array<StatusCandidate>,
  unseenWorkspaces: Array<Workspace>,
  width: number,
  workspace: Workspace,
  workspaces: Array<Workspace>,
|};

@autobind
class Sidebar extends React.PureComponent<Props> {
  render() {
    const {
      activeEnvironment,
      children,
      enableSyncBeta,
      environmentHighlightColorStyle,
      hidden,
      syncItems,
      vcs,
      width,
      workspace,
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
        {children}

        {enableSyncBeta && vcs && isLoggedIn() && (
          <SyncDropdown
            className="sidebar__footer"
            workspace={workspace}
            vcs={vcs}
            syncItems={syncItems}
          />
        )}

        {!enableSyncBeta && (
          <SyncLegacyDropdown
            className="sidebar__footer"
            key={workspace._id}
            workspace={workspace}
          />
        )}
      </aside>
    );
  }
}

export default Sidebar;
