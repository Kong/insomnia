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
type Props = {
  activeEnvironment: Environment | null;
  children: React.ReactNode;
  environmentHighlightColorStyle: string;
  handleSetActiveEnvironment: (...args: Array<any>) => any;
  handleSetActiveWorkspace: (...args: Array<any>) => any;
  hidden: boolean;
  hotKeyRegistry: HotKeyRegistry;
  isLoading: boolean;
  showEnvironmentsModal: (...args: Array<any>) => any;
  unseenWorkspaces: Array<Workspace>;
  width: number;
  workspaces: Array<Workspace>;
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class Sidebar extends React.PureComponent<Props> {
  render() {
    const {
      activeEnvironment,
      children,
      environmentHighlightColorStyle,
      hidden,
      width,
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
      </aside>
    );
  }
}

export default Sidebar;
