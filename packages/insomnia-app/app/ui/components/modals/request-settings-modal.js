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

type Props = {
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  workspaces: Array<Workspace>
};

type State = {
  request: Request | null,
  showDescription: boolean,
  defaultPreviewMode: boolean,
  activeWorkspaceIdToCopyTo: string | null,
  workspace: Workspace | null,
  justCopied: boolean,
  justMoved: boolean
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
      justMoved: false
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
      [setting]: value
    });
    this.setState({ request });
  }

  async _handleNameChange(name: string) {
    if (!this.state.request) {
      return;
    }
    const request = await models.request.update(this.state.request, { name });
    this.setState({ request });
  }

  async _handleDescriptionChange(description: string) {
    if (!this.state.request) {
      return;
    }
    const request = await models.request.update(this.state.request, {
      description
    });
    this.setState({ request, defaultPreviewMode: false });
  }

  _handleAddDescription() {
    this.setState({ showDescription: true });
  }

  _handleUpdateMoveCopyWorkspace(e: SyntheticEvent<HTMLSelectElement>) {
    const workspaceId = e.currentTarget.value;
    this.setState({ activeWorkspaceIdToCopyTo: workspaceId });
  }

  async _handleMoveToWorkspace() {
    const { activeWorkspaceIdToCopyTo, request } = this.state;
    if (!request) {
      return;
    }

    const workspace = await models.workspace.getById(
      activeWorkspaceIdToCopyTo || 'n/a'
    );
    if (!workspace) {
      return;
    }

    await models.request.update(request, {
      sortKey: -1e9, // Move to top of sort order
      parentId: activeWorkspaceIdToCopyTo
    });

    this.setState({ justMoved: true });
    setTimeout(() => {
      this.setState({ justMoved: false });
    }, 2000);
  }

  async _handleCopyToWorkspace() {
    const { activeWorkspaceIdToCopyTo, request } = this.state;
    if (!request) {
      return;
    }

    const workspace = await models.workspace.getById(
      activeWorkspaceIdToCopyTo || 'n/a'
    );
    if (!workspace) {
      return;
    }

    const newRequest = await models.request.duplicate(request);
    await models.request.update(newRequest, {
      sortKey: -1e9, // Move to top of sort order
      name: request.name, // Because duplicate will add (Copy) suffix
      parentId: activeWorkspaceIdToCopyTo
    });

    this.setState({ justCopied: true });
    setTimeout(() => {
      this.setState({ justCopied: false });
    }, 2000);
  }

  async show({
    request,
    forceEditMode
  }: {
    request: Request,
    forceEditMode: boolean
  }) {
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
        activeWorkspaceIdToCopyTo: workspace ? workspace._id : 'n/a',
        showDescription: forceEditMode || hasDescription,
        defaultPreviewMode: hasDescription && !forceEditMode
      },
      () => {
        this.modal && this.modal.show();

        if (forceEditMode) {
          setTimeout(() => {
            this._editor && this._editor.focus();
          }, 400);
        }
      }
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

  renderModalBody(request: Request) {
    const {
      editorLineWrapping,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      workspaces
    } = this.props;

    const {
      showDescription,
      defaultPreviewMode,
      activeWorkspaceIdToCopyTo,
      justMoved,
      justCopied,
      workspace
    } = this.state;

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>
            Name{' '}
            <span className="txt-sm faint italic">
              (also rename by double-clicking in sidebar)
            </span>
            <DebouncedInput
              delay={500}
              type="text"
              placeholder="My Request"
              defaultValue={request.name}
              onChange={this._handleNameChange}
            />
          </label>
        </div>
        {showDescription ? (
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
            defaultValue={request.description}
            onChange={this._handleDescriptionChange}
          />
        ) : (
          <button
            onClick={this._handleAddDescription}
            className="btn btn--outlined btn--super-duper-compact">
            Add Description
          </button>
        )}
        <div className="pad-top">
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
                Automatically encode special characters at send time (does not
                apply to query parameters editor)
              </HelpTooltip>
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Skip rendering of request body
              {this.renderCheckboxInput('settingDisableRenderRequestBody')}
              <HelpTooltip position="top" className="space-left">
                Disable rendering of environment variables and tags for the
                request body
              </HelpTooltip>
            </label>
          </div>
          <div className="form-control form-control--thin">
            <label>
              Rebuild path dot sequences
              <HelpTooltip position="top" className="space-left">
                This instructs libcurl to squash sequences of "/../" or "/./"
                that may exist in the URL's path part and that is supposed to be
                removed according to RFC 3986 section 5.2.4
              </HelpTooltip>
              {this.renderCheckboxInput('settingRebuildPath')}
            </label>
          </div>
          <hr />
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <label>
                Move/Copy to Workspace
                <HelpTooltip position="top" className="space-left">
                  Copy or move the current request to a new workspace. It will
                  be placed at the root of the new workspace's folder structure.
                </HelpTooltip>
                <select
                  value={activeWorkspaceIdToCopyTo}
                  onChange={this._handleUpdateMoveCopyWorkspace}>
                  <option value="n/a">-- Select Workspace --</option>
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
                disabled={justCopied}
                className="btn btn--clicky"
                onClick={this._handleCopyToWorkspace}>
                {justCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="form-control form-control--no-label width-auto">
              <button
                disabled={justMoved}
                className="btn btn--clicky"
                onClick={this._handleMoveToWorkspace}>
                {justMoved ? 'Moved!' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { request } = this.state;
    return (
      <Modal ref={this._setModalRef} freshState>
        <ModalHeader>
          Request Settings{' '}
          <span className="txt-sm selectable faint monospace">
            {request ? request._id : ''}
          </span>
        </ModalHeader>
        <ModalBody className="pad">
          {request ? this.renderModalBody(request) : null}
        </ModalBody>
      </Modal>
    );
  }
}

export default RequestSettingsModal;
