// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import HelpTooltip from '../help-tooltip';
import * as models from '../../../models';
import DebouncedInput from '../base/debounced-input';
import MarkdownEditor from '../markdown-editor';
import * as db from '../../../common/database';
import type { Workspace } from '../../../models/workspace';
import type { Request } from '../../../models/request';
import type { GrpcRequest } from '../../../models/grpc-request';
import { isGrpcRequest } from '../../../models/helpers/is-model';
import * as requestOperations from '../../../models/helpers/request-operations';

type Props = {
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  workspaces: Array<Workspace>,
};

type State = {
  request: Request | GrpcRequest | null,
  showDescription: boolean,
  defaultPreviewMode: boolean,
  activeWorkspaceIdToCopyTo: string | null,
  workspace: Workspace | null,
  justCopied: boolean,
  justMoved: boolean,
};

type RequestSettingsModalOptions = {
  request: Request | GrpcRequest,
  forceEditMode: boolean,
};

@autobind
class RequestSettingsModal extends React.PureComponent<Props, State> {
  modal: ?Modal;
  _editor: ?MarkdownEditor;

  constructor(props: Props) {
    super(props);
    this.state = {
      request: null,
      showDescription: false,
      defaultPreviewMode: false,
      activeWorkspaceIdToCopyTo: null,
      workspace: null,
      workspaces: [],
      justCopied: false,
      justMoved: false,
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  _setEditorRef(n: ?MarkdownEditor) {
    this._editor = n;
  }

  async _updateRequestSettingBoolean(e: SyntheticEvent<HTMLInputElement>) {
    if (!this.state.request) {
      // Should never happen
      return;
    }

    const value = e.currentTarget.checked;
    const setting = e.currentTarget.name;
    const request = await models.request.update(this.state.request, {
      [setting]: value,
    });
    this.setState({ request });
  }

  async _updateRequestSettingString(e: SyntheticEvent<HTMLInputElement>) {
    if (!this.state.request) {
      // Should never happen
      return;
    }

    const value = e.currentTarget.value;
    const setting = e.currentTarget.name;
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
    const patch = { name };

    const updatedRequest = isGrpcRequest(originalRequest)
      ? await models.grpcRequest.update(originalRequest, patch)
      : await models.request.update(originalRequest, patch);

    this.setState({ request: updatedRequest });
  }

  async _handleDescriptionChange(description: string) {
    if (!this.state.request) {
      return;
    }
    const request = await models.request.update(this.state.request, {
      description,
    });
    this.setState({ request, defaultPreviewMode: false });
  }

  _handleAddDescription() {
    this.setState({ showDescription: true });
  }

  _handleUpdateMoveCopyWorkspace(e: SyntheticEvent<HTMLSelectElement>) {
    const { value } = e.currentTarget;
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
      metaSortKey: -1e9, // Move to top of sort order
      parentId: activeWorkspaceIdToCopyTo,
    };

    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267

    await requestOperations.update(request, patch);

    this.setState({ justMoved: true });
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
      metaSortKey: -1e9, // Move to top of sort order
      name: request.name, // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: activeWorkspaceIdToCopyTo,
    };

    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267

    await requestOperations.duplicate(request, patch);

    this.setState({ justCopied: true });
    setTimeout(() => {
      this.setState({ justCopied: false });
    }, 2000);

    models.stats.incrementCreatedRequests();
  }

  async show({ request, forceEditMode }: RequestSettingsModalOptions) {
    const { workspaces } = this.props;

    const hasDescription = !!request.description;

    // Find workspaces for use with moving workspace
    const ancestors = await db.withAncestors(request);
    const doc = ancestors.find(doc => doc.type === models.workspace.type);
    const workspaceId = doc ? doc._id : 'should-never-happen';
    const workspace = workspaces.find(w => w._id === workspaceId);

    this.setState(
      {
        request,
        workspace: workspace,
        activeWorkspaceIdToCopyTo: null,
        showDescription: forceEditMode || hasDescription,
        defaultPreviewMode: hasDescription && !forceEditMode,
      },
      () => {
        this.modal && this.modal.show();

        if (forceEditMode) {
          setTimeout(() => {
            this._editor && this._editor.focus();
          }, 400);
        }
      },
    );
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderCheckboxInput(setting: string) {
    const { request } = this.state;
    if (!request) {
      return;
    }

    return (
      <input
        type="checkbox"
        name={setting}
        checked={request[setting]}
        onChange={this._updateRequestSettingBoolean}
      />
    );
  }

  _renderRequestSettings(): React.Node {
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
              defaultValue={this.state.request && this.state.request.settingFollowRedirects}
              name="settingFollowRedirects"
              onChange={this._updateRequestSettingString}>
              <option value={'global'}>Use global setting</option>
              <option value={'off'}>Don't follow redirects</option>
              <option value={'on'}>Follow redirects</option>
            </select>
          </label>
        </div>
      </>
    );
  }

  _renderDescription(): React.Node {
    const {
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    const { showDescription, defaultPreviewMode, request } = this.state;

    // Don't show description if it doesn't exist, or if it is a gRPC request
    if (!request || isGrpcRequest(request)) {
      return null;
    }

    return showDescription ? (
      <MarkdownEditor
        ref={this._setEditorRef}
        className="margin-top"
        defaultPreviewMode={defaultPreviewMode}
        fontSize={editorFontSize}
        indentSize={editorIndentSize}
        keyMap={editorKeyMap}
        placeholder="Write a description"
        lineWrapping={editorLineWrapping}
        handleRender={handleRender}
        handleGetRenderContext={handleGetRenderContext}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        isVariableUncovered={isVariableUncovered}
        defaultValue={request.description}
        onChange={this._handleDescriptionChange}
      />
    ) : (
      <button
        onClick={this._handleAddDescription}
        className="btn btn--outlined btn--super-duper-compact">
        Add Description
      </button>
    );
  }

  _renderFeatureRequestPrompt(): React.Node {
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

  _renderMoveCopy(): React.Node {
    const { workspaces } = this.props;

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
              onChange={this._handleUpdateMoveCopyWorkspace}>
              <option value="__NULL__">-- Select Workspace --</option>
              {workspaces.map(w => {
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
            onClick={this._handleCopyToWorkspace}>
            {justCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="form-control form-control--no-label width-auto">
          <button
            disabled={justMoved || !activeWorkspaceIdToCopyTo}
            className="btn btn--clicky"
            onClick={this._handleMoveToWorkspace}>
            {justMoved ? 'Moved!' : 'Move'}
          </button>
        </div>
      </div>
    );
  }

  renderModalBody(): React.Node {
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

export default RequestSettingsModal;
