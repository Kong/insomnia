// @flow
import React from 'react';
import PropTypes from 'prop-types';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import PromptButton from '../base/prompt-button';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem,
} from '../base/dropdown/index';
import { hotKeyRefs } from '../../../common/hotkeys';
import * as misc from '../../../common/misc';
import { isRequest } from '../../../models/helpers/is-model';
import * as requestOperations from '../../../models/helpers/request-operations';
import { incrementDeletedRequests } from '../../../models/stats';

// Plugin action related imports
import type { RequestAction, RequestGroupAction } from '../../../plugins';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import type { Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import type { Environment } from '../../../models/environment';
import { getRequestActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { showError } from '../modals';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import classnames from 'classnames';

type Props = {
  handleDuplicateRequest: Function,
  handleGenerateCode: Function,
  handleCopyAsCurl: Function,
  handleShowSettings: Function,
  isPinned: Boolean,
  request: Request,
  requestGroup: RequestGroup,
  hotKeyRegistry: HotKeyRegistry,
  handleSetRequestPinned: Function,
  activeEnvironment: Environment | null,
};

// Setup state for plugin actions
type State = {
  actionPlugins: Array<RequestGroupAction>,
  loadingActions: { [string]: boolean },
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class RequestActionsDropdown extends React.PureComponent<Props, State> {
  _dropdown: ?Dropdown;

  state = {
    actionPlugins: [],
    loadingActions: {},
  };

  _setDropdownRef(n) {
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
    const plugins = await getRequestActions();
    this.setState({ actionPlugins: plugins });
  }

  async show() {
    this._dropdown && this._dropdown.show();
  }

  async _handlePluginClick(p: RequestAction) {
    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: true } }));

    try {
      const { activeEnvironment, request, requestGroup } = this.props;
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER): Object),
        ...(pluginContexts.data.init(): Object),
        ...(pluginContexts.store.init(p.plugin): Object),
        ...(pluginContexts.network.init(activeEnvironmentId): Object),
      };

      await p.action(context, { request, requestGroup });
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
      request, // eslint-disable-line no-unused-vars
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
        {actionPlugins.map((p: RequestAction) => (
          <DropdownItem
            key={`${p.plugin.name}::${p.label}`}
            value={p}
            onClick={this._handlePluginClick}
            stayOpenAfterClick>
            {loadingActions[p.label] ? (
              <i className="fa fa-refresh fa-spin" />
            ) : (
              <i className={classnames('fa', p.icon || 'fa-code')} />
            )}
            {p.label}
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

RequestActionsDropdown.propTypes = {
  handleDuplicateRequest: PropTypes.func.isRequired,
  handleGenerateCode: PropTypes.func.isRequired,
  handleCopyAsCurl: PropTypes.func.isRequired,
  handleShowSettings: PropTypes.func.isRequired,
  isPinned: PropTypes.bool.isRequired,
  request: PropTypes.object.isRequired, // can be Request or GrpcRequest
  hotKeyRegistry: PropTypes.object.isRequired,
  handleSetRequestPinned: PropTypes.func.isRequired,
};

export default RequestActionsDropdown;
