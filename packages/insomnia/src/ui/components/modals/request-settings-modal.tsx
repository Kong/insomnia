import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef, PureComponent } from 'react';
import { connect } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { database as db } from '../../../common/database';
import * as models from '../../../models';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import * as requestOperations from '../../../models/helpers/request-operations';
import type { BaseRequest, Request } from '../../../models/request';
import { isWorkspace, Workspace } from '../../../models/workspace';
import { RootState } from '../../redux/modules';
import { selectWorkspacesForActiveProject } from '../../redux/selectors';
import { DebouncedInput } from '../base/debounced-input';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { UnconnectedCodeEditor } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { MarkdownEditor } from '../markdown-editor';

type ReduxProps = ReturnType<typeof mapStateToProps>;

interface Props extends ReduxProps {
}

interface State {
  request: Request | GrpcRequest | null;
  showDescription: boolean;
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string | null;
  workspace?: Workspace;
  workspacesForActiveProject: Workspace[];
  justCopied: boolean;
  justMoved: boolean;
}

interface RequestSettingsModalOptions {
  request: Request | GrpcRequest;
  forceEditMode: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedRequestSettingsModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  _editorRef = createRef<UnconnectedCodeEditor>();

  state: State = {
    request: null,
    showDescription: false,
    defaultPreviewMode: false,
    activeWorkspaceIdToCopyTo: null,
    workspace: undefined,
    workspacesForActiveProject: [],
    justCopied: false,
    justMoved: false,
  };

  _setModalRef(modal: Modal) {
    this.modal = modal;
  }

  async _updateRequestSettingBoolean(event: React.SyntheticEvent<HTMLInputElement>) {
    if (!this.state.request) {
      // Should never happen
      return;
    }

    const value = event.currentTarget.checked;
    const setting = event.currentTarget.name;
    // @ts-expect-error -- TSCONVERSION request settings only exist for regular requests, the types should filter down and exit if grpc
    const request = await models.request.update(this.state.request, {
      [setting]: value,
    });
    this.setState({ request });
  }

  async _updateRequestSettingString(event: React.SyntheticEvent<HTMLInputElement | HTMLSelectElement>) {
    if (!this.state.request) {
      // Should never happen
      return;
    }

    const value = event.currentTarget.value;
    const setting = event.currentTarget.name;
    // @ts-expect-error -- TSCONVERSION request settings only exist for regular requests, the types should filter down and exit if grpc
    const request = await models.request.update(this.state.request, {
      [setting]: value,
    });
    this.setState({ request });
  }

  async _handleNameChange(name: string) {
    const { request: originalRequest } = this.state;

    if (!originalRequest) {
      return;
    }

    const patch = {
      name,
    };
    const updatedRequest = isGrpcRequest(originalRequest)
      ? await models.grpcRequest.update(originalRequest, patch)
      : await models.request.update(originalRequest, patch);
    this.setState({ request: updatedRequest });
  }

  async _handleDescriptionChange(description: string) {
    if (!this.state.request) {
      return;
    }

    // @ts-expect-error -- TSCONVERSION description only exists for regular requests at the moment, the types should filter down and exit if grpc
    const request = await models.request.update(this.state.request, {
      description,
    });
    this.setState({
      request,
      defaultPreviewMode: false,
    });
  }

  _handleAddDescription() {
    this.setState({ showDescription: true });
  }

  _handleUpdateMoveCopyWorkspace(event: React.SyntheticEvent<HTMLSelectElement>) {
    const { value } = event.currentTarget;
    const workspaceId = value === '__NULL__' ? null : value;
    this.setState({ activeWorkspaceIdToCopyTo: workspaceId });
  }

  async _handleMoveToWorkspace() {
    const { activeWorkspaceIdToCopyTo, request } = this.state;

    if (!request || !activeWorkspaceIdToCopyTo) {
      return;
    }

    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);

    if (!workspace) {
      return;
    }

    const patch = {
      metaSortKey: -1e9,
      // Move to top of sort order
      parentId: activeWorkspaceIdToCopyTo,
    };
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    await requestOperations.update(request, patch);
    this.setState({
      justMoved: true,
    });
    setTimeout(() => {
      this.setState({ justMoved: false });
    }, 2000);
  }

  async _handleCopyToWorkspace() {
    const { activeWorkspaceIdToCopyTo, request } = this.state;

    if (!request || !activeWorkspaceIdToCopyTo) {
      return;
    }

    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);

    if (!workspace) {
      return;
    }

    const patch = {
      metaSortKey: -1e9,
      // Move to top of sort order
      name: request.name,
      // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: activeWorkspaceIdToCopyTo,
    };
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    await requestOperations.duplicate(request, patch);
    this.setState({
      justCopied: true,
    });
    setTimeout(() => {
      this.setState({
        justCopied: false,
      });
    }, 2000);
    models.stats.incrementCreatedRequests();
  }

  async show({ request, forceEditMode }: RequestSettingsModalOptions) {
    const { workspacesForActiveProject } = this.props;
    const hasDescription = !!request.description;
    // Find workspaces for use with moving workspace
    const ancestors = await db.withAncestors(request);
    const doc = ancestors.find(isWorkspace);
    const workspaceId = doc ? doc._id : 'should-never-happen';
    const workspace = workspacesForActiveProject.find(w => w._id === workspaceId);
    this.setState(
      {
        request,
        workspace: workspace,
        activeWorkspaceIdToCopyTo: null,
        showDescription: forceEditMode || hasDescription,
        defaultPreviewMode: hasDescription && !forceEditMode,
      },
      () => {
        this.modal?.show();

        if (forceEditMode) {
          setTimeout(() => {
            this._editorRef.current?.focus();
          }, 400);
        }
      },
    );
  }

  hide() {
    this.modal?.hide();
  }

  renderCheckboxInput(setting: keyof BaseRequest) {
    const { request } = this.state;

    if (!request) {
      return;
    }

    return (
      <input
        type="checkbox"
        name={setting}
        // @ts-expect-error -- mapping unsoundness
        checked={request[setting]}
        onChange={this._updateRequestSettingBoolean}
      />
    );
  }

  _renderRequestSettings() {
    const { request } = this.state;

    // GrpcRequests do not have any request settings (yet)
    // When the time comes, explore creating a standalone request settings modal for gRPC
    if (!request || isGrpcRequest(request)) {
      return null;
    }

    return (
      <>
        <div className="pad-top pad-bottom">
          <div className="form-control form-control--thin">
            <label>
              Send cookies automatically
              {this.renderCheckboxInput('settingSendCookies')}
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Store cookies automatically
              {this.renderCheckboxInput('settingStoreCookies')}
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Automatically encode special characters in URL
              {this.renderCheckboxInput('settingEncodeUrl')}
              <HelpTooltip position="top" className="space-left">
                Automatically encode special characters at send time (does not apply to query
                parameters editor)
              </HelpTooltip>
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Skip rendering of request body
              {this.renderCheckboxInput('settingDisableRenderRequestBody')}
              <HelpTooltip position="top" className="space-left">
                Disable rendering of environment variables and tags for the request body
              </HelpTooltip>
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Rebuild path dot sequences
              <HelpTooltip position="top" className="space-left">
                This instructs libcurl to squash sequences of "/../" or "/./" that may exist in the
                URL's path part and that is supposed to be removed according to RFC 3986 section
                5.2.4
              </HelpTooltip>
              {this.renderCheckboxInput('settingRebuildPath')}
            </label>
          </div>
        </div>
        <div className="form-control form-control--outlined">
          <label>
            Follow redirects <span className="txt-sm faint italic">(overrides global setting)</span>
            <select
              // @ts-expect-error -- TSCONVERSION this setting only exists for a Request not GrpcRequest
              defaultValue={this.state.request?.settingFollowRedirects}
              name="settingFollowRedirects"
              onChange={this._updateRequestSettingString}
            >
              <option value={'global'}>Use global setting</option>
              <option value={'off'}>Don't follow redirects</option>
              <option value={'on'}>Follow redirects</option>
            </select>
          </label>
        </div>
      </>
    );
  }

  _renderDescription() {
    const { showDescription, defaultPreviewMode, request } = this.state;

    // Don't show description if it doesn't exist, or if it is a gRPC request
    if (!request || isGrpcRequest(request)) {
      return null;
    }

    return showDescription ? (
      <MarkdownEditor
        ref={this._editorRef}
        className="margin-top"
        defaultPreviewMode={defaultPreviewMode}
        placeholder="Write a description"
        defaultValue={request.description}
        onChange={this._handleDescriptionChange}
      />
    ) : (
      <button
        onClick={this._handleAddDescription}
        className="btn btn--outlined btn--super-duper-compact"
      >
        Add Description
      </button>
    );
  }

  _renderFeatureRequestPrompt() {
    const { request } = this.state;

    // Don't show move/copy items if it doesn't exist, or if it is a gRPC request
    if (request && isGrpcRequest(request)) {
      return (
        <p className="faint italic">
          Are there any gRPC settings you expect to see? Create a{' '}
          <a href={'https://github.com/Kong/insomnia/issues/new/choose'}>feature request</a>!
        </p>
      );
    }

    return null;
  }

  _renderMoveCopy() {
    const { workspacesForActiveProject } = this.props;
    const { activeWorkspaceIdToCopyTo, justMoved, justCopied, workspace, request } = this.state;

    // Don't show move/copy items if it doesn't exist, or if it is a gRPC request
    if (!request || isGrpcRequest(request)) {
      return null;
    }

    return (
      <div className="form-row">
        <div className="form-control form-control--outlined">
          <label>
            Move/Copy to Workspace
            <HelpTooltip position="top" className="space-left">
              Copy or move the current request to a new workspace. It will be placed at the root of
              the new workspace's folder structure.
            </HelpTooltip>
            <select
              value={activeWorkspaceIdToCopyTo || '__NULL__'}
              onChange={this._handleUpdateMoveCopyWorkspace}
            >
              <option value="__NULL__">-- Select Workspace --</option>
              {workspacesForActiveProject.map(w => {
                if (workspace && workspace._id === w._id) {
                  return null;
                }

                return (
                  <option key={w._id} value={w._id}>
                    {w.name}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <div className="form-control form-control--no-label width-auto">
          <button
            disabled={justCopied || !activeWorkspaceIdToCopyTo}
            className="btn btn--clicky"
            onClick={this._handleCopyToWorkspace}
          >
            {justCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="form-control form-control--no-label width-auto">
          <button
            disabled={justMoved || !activeWorkspaceIdToCopyTo}
            className="btn btn--clicky"
            onClick={this._handleMoveToWorkspace}
          >
            {justMoved ? 'Moved!' : 'Move'}
          </button>
        </div>
      </div>
    );
  }

  renderModalBody() {
    const { request } = this.state;

    if (!request) {
      return null;
    }

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>
            Name{' '}
            <span className="txt-sm faint italic">(also rename by double-clicking in sidebar)</span>
            <DebouncedInput
              delay={500}
              // @ts-expect-error -- TSCONVERSION props expand into an input but are difficult to type
              type="text"
              placeholder={request.url || 'My Request'}
              defaultValue={request.name}
              onChange={this._handleNameChange}
            />
          </label>
        </div>
        {this._renderDescription()}
        {this._renderRequestSettings()}
        <hr />
        {this._renderMoveCopy()}
        {this._renderFeatureRequestPrompt()}
      </div>
    );
  }

  render() {
    const { request } = this.state;
    return (
      <Modal ref={this._setModalRef} freshState>
        <ModalHeader>
          Request Settings{' '}
          <span className="txt-sm selectable faint monospace">{request ? request._id : ''}</span>
        </ModalHeader>
        <ModalBody className="pad">{this.renderModalBody()}</ModalBody>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  workspacesForActiveProject: selectWorkspacesForActiveProject(state),
});

export const RequestSettingsModal = connect(
  mapStateToProps,
  null,
  null,
  { forwardRef: true },
)(UnconnectedRequestSettingsModal);
