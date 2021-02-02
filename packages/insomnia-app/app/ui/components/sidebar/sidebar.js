// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import type { Workspace } from '../../../models/workspace';
import type { Environment } from '../../../models/environment';
import classnames from 'classnames';
import {
  COLLAPSE_SIDEBAR_REMS,
  SIDEBAR_SKINNY_REMS,
  AUTOBIND_CFG,
} from '../../../common/constants';
import SyncDropdown from '../dropdowns/sync-dropdown';
import type { StatusCandidate } from '../../../sync/types';
import { isLoggedIn } from '../../../account/session';

type Props = {|
  activeEnvironment: Environment | null,
  children: React.Node,
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

@autoBindMethodsForReact(AUTOBIND_CFG)
class Sidebar extends React.PureComponent<Props> {
  render() {
    const {
      activeEnvironment,
      children,
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

        {vcs && isLoggedIn() && (
          <SyncDropdown
            className="sidebar__footer"
            workspace={workspace}
            vcs={vcs}
            syncItems={syncItems}
          />
        )}
      </aside>
    );
  }
}

export default Sidebar;
