import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { HotKeyRegistry } from 'insomnia-common';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { RootState } from '../../redux/modules';
import { selectActiveEnvironment, selectActiveProject } from '../../redux/selectors';
import { Dropdown, DropdownProps } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { showError, showModal } from '../modals';
import { EnvironmentEditModal } from '../modals/environment-edit-modal';

type ReduxProps = ReturnType<typeof mapStateToProps>;

const mapStateToProps = (state: RootState) => ({
  activeProject: selectActiveProject(state),
  activeEnvironment: selectActiveEnvironment(state),
});

interface Props extends ReduxProps, Partial<DropdownProps> {
  requestGroup: RequestGroup;
  hotKeyRegistry: HotKeyRegistry;
  handleCreateRequest: (id: string) => any;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  handleShowSettings: (requestGroup: RequestGroup) => any;
  handleCreateRequestGroup: (requestGroup: string) => any;
}

interface State {
  actionPlugins: RequestGroupAction[];
  loadingActions: Record<string, boolean>;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedRequestGroupActionsDropdown extends PureComponent<Props, State> {
  _dropdown: Dropdown | null = null;
  state: State = {
    actionPlugins: [],
    loadingActions: {},
  };

  _setDropdownRef(n: Dropdown) {
    this._dropdown = n;
  }

  async _handleRequestCreate() {
    this.props.handleCreateRequest(this.props.requestGroup._id);
  }

  _handleRequestGroupDuplicate() {
    this.props.handleDuplicateRequestGroup(this.props.requestGroup);
  }

  async _handleRequestGroupCreate() {
    this.props.handleCreateRequestGroup(this.props.requestGroup._id);
  }

  async _handleDeleteFolder() {
    await models.stats.incrementDeletedRequestsForDescendents(this.props.requestGroup);
    models.requestGroup.remove(this.props.requestGroup);
  }

  _handleEditEnvironment() {
    showModal(EnvironmentEditModal, this.props.requestGroup);
  }

  async onOpen() {
    const plugins = await getRequestGroupActions();
    this.setState({
      actionPlugins: plugins,
    });
  }

  async show() {
    this._dropdown?.show();
  }

  async _handlePluginClick(p: RequestGroupAction) {
    this.setState(state => ({
      loadingActions: { ...state.loadingActions, [p.label]: true },
    }));

    try {
      const { activeEnvironment, requestGroup, activeProject } = this.props;
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(p.plugin) as Record<string, any>),
        ...(pluginContexts.network.init(activeEnvironmentId) as Record<string, any>),
      };
      const requests = await models.request.findByParentId(requestGroup._id);
      requests.sort((a, b) => a.metaSortKey - b.metaSortKey);
      await p.action(context, {
        requestGroup,
        requests,
      });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }

    this.setState(state => ({
      loadingActions: { ...state.loadingActions, [p.label]: false },
    }));
    this._dropdown?.hide();
  }

  render() {
    const {
      // eslint-disable-line @typescript-eslint/no-unused-vars
      requestGroup,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      hotKeyRegistry,
      ...other
    } = this.props;
    const { actionPlugins, loadingActions } = this.state;
    return (
      <Dropdown ref={this._setDropdownRef} onOpen={this.onOpen} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem onClick={this._handleRequestCreate}>
          <i className="fa fa-plus-circle" /> New Request
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE.id]} />
        </DropdownItem>
        <DropdownItem onClick={this._handleRequestGroupCreate}>
          <i className="fa fa-folder" /> New Folder
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]} />
        </DropdownItem>
        <DropdownDivider />
        <DropdownItem onClick={this._handleRequestGroupDuplicate}>
          <i className="fa fa-copy" /> Duplicate
        </DropdownItem>
        <DropdownItem onClick={this._handleEditEnvironment}>
          <i className="fa fa-code" /> Environment
        </DropdownItem>
        <DropdownItem buttonClass={PromptButton} addIcon onClick={this._handleDeleteFolder}>
          <i className="fa fa-trash-o" /> Delete
        </DropdownItem>
        {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
        {actionPlugins.map((p: RequestGroupAction) => (
          <DropdownItem key={p.label} onClick={() => this._handlePluginClick(p)} stayOpenAfterClick>
            {loadingActions[p.label] ? (
              <i className="fa fa-refresh fa-spin" />
            ) : (
              <i className={classnames('fa', p.icon || 'fa-code')} />
            )}
            {p.label}
          </DropdownItem>
        ))}
        <DropdownDivider />
        <DropdownItem onClick={this.props.handleShowSettings}>
          <i className="fa fa-wrench" /> Settings
        </DropdownItem>
      </Dropdown>
    );
  }
}

export const RequestGroupActionsDropdown = connect(mapStateToProps, null, null, { forwardRef: true })(UnconnectedRequestGroupActionsDropdown);
