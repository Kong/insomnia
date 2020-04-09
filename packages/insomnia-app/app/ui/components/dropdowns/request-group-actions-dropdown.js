// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import PromptButton from '../base/prompt-button';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem,
} from '../base/dropdown';
import EnvironmentEditModal from '../modals/environment-edit-modal';
import * as models from '../../../models';
import { showError, showModal, showPrompt } from '../modals';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import * as pluginContexts from '../../../plugins/context/index';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { Environment } from '../../../models/environment';

type Props = {
  workspace: Workspace,
  requestGroup: RequestGroup,
  hotKeyRegistry: HotKeyRegistry,
  activeEnvironment: Environment | null,
  handleCreateRequest: (id: string) => any,
  handleDuplicateRequestGroup: (rg: RequestGroup) => any,
  handleMoveRequestGroup: (rg: RequestGroup) => any,
  handleCreateRequestGroup: (id: string) => any,
};

type State = {
  actionPlugins: Array<RequestGroupAction>,
  loadingActions: { [string]: boolean },
};

@autobind
class RequestGroupActionsDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  state = {
    actionPlugins: [],
    loadingActions: {},
  };

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  _handleRename() {
    const { requestGroup } = this.props;

    showPrompt({
      title: 'Rename Folder',
      defaultValue: requestGroup.name,
      onComplete: name => {
        models.requestGroup.update(requestGroup, { name });
      },
    });
  }

  async _handleRequestCreate() {
    this.props.handleCreateRequest(this.props.requestGroup._id);
  }

  _handleRequestGroupDuplicate() {
    this.props.handleDuplicateRequestGroup(this.props.requestGroup);
  }

  _handleRequestGroupMove() {
    this.props.handleMoveRequestGroup(this.props.requestGroup);
  }

  async _handleRequestGroupCreate() {
    this.props.handleCreateRequestGroup(this.props.requestGroup._id);
  }

  _handleDeleteFolder() {
    models.requestGroup.remove(this.props.requestGroup);
  }

  _handleEditEnvironment() {
    showModal(EnvironmentEditModal, this.props.requestGroup);
  }

  async onOpen() {
    const plugins = await getRequestGroupActions();
    this.setState({ actionPlugins: plugins });
  }

  async show() {
    this._dropdown && this._dropdown.show();
  }

  async _handlePluginClick(p: RequestGroupAction) {
    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: true } }));

    try {
      const { activeEnvironment, requestGroup } = this.props;
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;

      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER): Object),
        ...(pluginContexts.data.init(): Object),
        ...(pluginContexts.store.init(p.plugin): Object),
        ...(pluginContexts.network.init(activeEnvironmentId): Object),
      };

      const requests = await models.request.findByParentId(requestGroup._id);
      requests.sort((a, b) => a.metaSortKey - b.metaSortKey);
      await p.action(context, { requestGroup, requests });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }

    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: false } }));
    this._dropdown && this._dropdown.hide();
  }

  render() {
    const {
      workspace, // eslint-disable-line no-unused-vars
      requestGroup, // eslint-disable-line no-unused-vars
      hotKeyRegistry,
      ...other
    } = this.props;

    const { actionPlugins, loadingActions } = this.state;

    return (
      <Dropdown ref={this._setDropdownRef} onOpen={this.onOpen} {...(other: Object)}>
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
        <DropdownItem onClick={this._handleRename}>
          <i className="fa fa-edit" /> Rename
        </DropdownItem>
        <DropdownItem onClick={this._handleEditEnvironment}>
          <i className="fa fa-code" /> Environment
        </DropdownItem>
        <DropdownItem onClick={this._handleRequestGroupMove}>
          <i className="fa fa-exchange" /> Move
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
      </Dropdown>
    );
  }
}

export default RequestGroupActionsDropdown;
