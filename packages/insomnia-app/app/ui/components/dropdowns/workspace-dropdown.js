// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG, getAppName, getAppVersion } from '../../../common/constants';
import classnames from 'classnames';
import Dropdown from '../base/dropdown/dropdown';
import DropdownDivider from '../base/dropdown/dropdown-divider';
import DropdownButton from '../base/dropdown/dropdown-button';
import DropdownItem from '../base/dropdown/dropdown-item';
import DropdownHint from '../base/dropdown/dropdown-hint';
import SettingsModal, { TAB_INDEX_EXPORT } from '../modals/settings-modal';
import * as models from '../../../models';

import { showError, showModal } from '../modals';
import WorkspaceSettingsModal from '../modals/workspace-settings-modal';
import KeydownBinder from '../keydown-binder';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import type { Workspace } from '../../../models/workspace';
import * as db from '../../../common/database';
import type { WorkspaceAction } from '../../../plugins';
import { ConfigGenerator, getConfigGenerators, getWorkspaceActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { Environment } from '../../../models/environment';
import { showGenerateConfigModal } from '../modals/generate-config-modal';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { isDesign } from '../../../models/helpers/is-model';

type Props = {
  displayName: string,
  activeEnvironment: Environment | null,
  activeWorkspace: Workspace,
  activeApiSpec: ApiSpec,
  hotKeyRegistry: HotKeyRegistry,
  isLoading: boolean,
  className?: string,
};

type State = {
  actionPlugins: Array<WorkspaceAction>,
  configGeneratorPlugins: Array<ConfigGenerator>,
  loadingActions: { [string]: boolean },
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class WorkspaceDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  state = {
    actionPlugins: [],
    configGeneratorPlugins: [],
    loadingActions: {},
  };

  async _handlePluginClick(p: WorkspaceAction) {
    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: true } }));

    const { activeEnvironment, activeWorkspace } = this.props;

    try {
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;

      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER): Object),
        ...(pluginContexts.data.init(): Object),
        ...(pluginContexts.store.init(p.plugin): Object),
        ...(pluginContexts.network.init(activeEnvironmentId): Object),
      };

      const docs = await db.withDescendants(activeWorkspace);
      const requests: any = docs.filter(d => d.type === models.request.type && !(d: any).isPrivate);
      const requestGroups: any = docs.filter(d => d.type === models.requestGroup.type);

      await p.action(context, { requestGroups, requests, workspace: activeWorkspace });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }

    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: false } }));
    this._dropdown && this._dropdown.hide();
  }

  async _handleDropdownOpen() {
    const actionPlugins = await getWorkspaceActions();
    const configGeneratorPlugins = await getConfigGenerators();
    this.setState({ actionPlugins, configGeneratorPlugins });
  }

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  static _handleShowExport() {
    showModal(SettingsModal, TAB_INDEX_EXPORT);
  }

  static _handleShowWorkspaceSettings() {
    showModal(WorkspaceSettingsModal);
  }

  _handleKeydown(e: KeyboardEvent) {
    executeHotKey(e, hotKeyRefs.TOGGLE_MAIN_MENU, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  async _handleGenerateConfig(label: string) {
    const { activeApiSpec } = this.props;
    showGenerateConfigModal({ apiSpec: activeApiSpec, activeTabLabel: label });
  }

  render() {
    const {
      displayName,
      className,
      activeWorkspace,
      isLoading,
      hotKeyRegistry,
      ...other
    } = this.props;

    const classes = classnames(className, 'wide', 'workspace-dropdown');

    const { actionPlugins, loadingActions, configGeneratorPlugins } = this.state;

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown
          beside
          ref={this._setDropdownRef}
          className={classes}
          onOpen={this._handleDropdownOpen}
          onHide={this._handleDropdownHide}
          {...(other: Object)}>
          <DropdownButton className="row">
            <div className="ellipsis" style={{ maxWidth: '400px' }} title={displayName}>
              {displayName}
            </div>
            <i className="fa fa-caret-down space-left" />
            {isLoading ? <i className="fa fa-refresh fa-spin space-left" /> : null}
          </DropdownButton>
          <DropdownDivider>
            {getAppName()} v{getAppVersion()}
          </DropdownDivider>
          <DropdownItem onClick={WorkspaceDropdown._handleShowWorkspaceSettings}>
            <i className="fa fa-wrench" /> {getWorkspaceLabel(activeWorkspace)} Settings
            <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.WORKSPACE_SHOW_SETTINGS.id]} />
          </DropdownItem>

          <DropdownItem onClick={WorkspaceDropdown._handleShowExport}>
            <i className="fa fa-share" /> Import/Export
          </DropdownItem>

          {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
          {actionPlugins.map((p: WorkspaceAction) => (
            <DropdownItem
              key={p.label}
              onClick={() => this._handlePluginClick(p)}
              stayOpenAfterClick>
              {loadingActions[p.label] ? (
                <i className="fa fa-refresh fa-spin" />
              ) : (
                <i className={classnames('fa', p.icon || 'fa-code')} />
              )}
              {p.label}
            </DropdownItem>
          ))}
          {isDesign(activeWorkspace) && (
            <>
              {configGeneratorPlugins.length > 0 && (
                <DropdownDivider>Config Generators</DropdownDivider>
              )}
              {configGeneratorPlugins.map((p: ConfigGenerator) => (
                <DropdownItem
                  key="generateConfig"
                  onClick={this._handleGenerateConfig}
                  value={p.label}>
                  <i className="fa fa-code" />
                  {p.label}
                </DropdownItem>
              ))}
            </>
          )}
        </Dropdown>
      </KeydownBinder>
    );
  }
}

export default WorkspaceDropdown;
