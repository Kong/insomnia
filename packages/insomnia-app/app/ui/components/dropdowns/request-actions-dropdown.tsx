import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import * as misc from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { Environment } from '../../../models/environment';
import { GrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import { Project } from '../../../models/project';
import { isRequest, Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { incrementDeletedRequests } from '../../../models/stats';
// Plugin action related imports
import type { RequestAction } from '../../../plugins';
import { getRequestActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import Dropdown, { DropdownProps } from '../base/dropdown/dropdown';
import {
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem,
} from '../base/dropdown/index';
import PromptButton from '../base/prompt-button';
import { showError } from '../modals';

interface Props extends Partial<DropdownProps> {
  handleDuplicateRequest: Function;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  handleShowSettings: Function;
  isPinned: Boolean;
  request: Request | GrpcRequest;
  requestGroup?: RequestGroup;
  hotKeyRegistry: HotKeyRegistry;
  handleSetRequestPinned: Function;
  activeEnvironment?: Environment | null;
  activeProject: Project;
}

// Setup state for plugin actions
interface State {
  actionPlugins: RequestAction[];
  loadingActions: Record<string, boolean>;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class RequestActionsDropdown extends PureComponent<Props, State> {
  _dropdown: Dropdown | null = null;

  state: State = {
    actionPlugins: [],
    loadingActions: {},
  };

  _setDropdownRef(n: Dropdown) {
    this._dropdown = n;
  }

  _handleDuplicate() {
    const { request, handleDuplicateRequest } = this.props;
    handleDuplicateRequest(request);
  }

  _handleGenerateCode() {
    this.props.handleGenerateCode(this.props.request);
  }

  _handleCopyAsCurl() {
    this.props.handleCopyAsCurl(this.props.request);
  }

  _canPin() {
    return this.props.handleSetRequestPinned !== misc.nullFn;
  }

  _handleSetRequestPinned() {
    this.props.handleSetRequestPinned(this.props.request, !this.props.isPinned);
  }

  _handleRemove() {
    const { request } = this.props;
    incrementDeletedRequests();
    return requestOperations.remove(request);
  }

  async _onOpen() {
    const actionPlugins = await getRequestActions();
    this.setState({ actionPlugins });
  }

  async show() {
    this._dropdown?.show();
  }

  async _handlePluginClick(p: RequestAction) {
    this.setState(state => ({
      loadingActions: { ...state.loadingActions, [p.label]: true },
    }));

    try {
      const { activeEnvironment, activeProject, request, requestGroup } = this.props;
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(p.plugin) as Record<string, any>),
        ...(pluginContexts.network.init(activeEnvironmentId) as Record<string, any>),
      };
      await p.action(context, {
        request,
        requestGroup,
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
      request,
      // eslint-disable-line @typescript-eslint/no-unused-vars
      handleShowSettings,
      hotKeyRegistry,
      ...other
    } = this.props;
    const { actionPlugins, loadingActions } = this.state;
    // Can only generate code for regular requests, not gRPC requests
    const canGenerateCode = isRequest(request);
    return (
      <Dropdown ref={this._setDropdownRef} onOpen={this._onOpen} {...other}>
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>

        <DropdownItem onClick={this._handleDuplicate}>
          <i className="fa fa-copy" /> Duplicate
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DUPLICATE.id]} />
        </DropdownItem>

        {canGenerateCode && (
          <DropdownItem onClick={this._handleGenerateCode}>
            <i className="fa fa-code" /> Generate Code
            <DropdownHint
              keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_GENERATE_CODE_EDITOR.id]}
            />
          </DropdownItem>
        )}

        <DropdownItem onClick={this._handleSetRequestPinned}>
          <i className="fa fa-thumb-tack" /> {this.props.isPinned ? 'Unpin' : 'Pin'}
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_TOGGLE_PIN.id]} />
        </DropdownItem>

        {canGenerateCode && (
          <DropdownItem onClick={this._handleCopyAsCurl}>
            <i className="fa fa-copy" /> Copy as Curl
          </DropdownItem>
        )}

        <DropdownItem buttonClass={PromptButton} onClick={this._handleRemove} addIcon>
          <i className="fa fa-trash-o" /> Delete
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_DELETE.id]} />
        </DropdownItem>

        {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
        {actionPlugins.map((plugin: RequestAction) => (
          <DropdownItem
            key={`${plugin.plugin.name}::${plugin.label}`}
            value={plugin}
            onClick={this._handlePluginClick}
            stayOpenAfterClick
          >
            {loadingActions[plugin.label] ? (
              <i className="fa fa-refresh fa-spin" />
            ) : (
              <i className={classnames('fa', plugin.icon || 'fa-code')} />
            )}
            {plugin.label}
          </DropdownItem>
        ))}

        <DropdownDivider />

        <DropdownItem onClick={handleShowSettings}>
          <i className="fa fa-wrench" /> Settings
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_SETTINGS.id]} />
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default RequestActionsDropdown;
