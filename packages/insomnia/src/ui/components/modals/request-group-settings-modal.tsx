import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { createRef } from 'react';
import { connect } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { database as db } from '../../../common/database';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
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
  requestGroup: RequestGroup | null;
  showDescription: boolean;
  defaultPreviewMode: boolean;
  activeWorkspaceIdToCopyTo: string | null;
  workspace?: Workspace;
  workspacesForActiveProject: Workspace[];
  justCopied: boolean;
  justMoved: boolean;
}

interface RequestGroupSettingsModalOptions {
  requestGroup: RequestGroup;
  forceEditMode: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedRequestGroupSettingsModal extends React.PureComponent<Props, State> {
  modal: Modal | null = null;
  _editorRef = createRef<UnconnectedCodeEditor>();

  state: State = {
    requestGroup: null,
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

  async _handleNameChange(name: string) {
    const { requestGroup: originalRequestGroup } = this.state;

    if (!originalRequestGroup) {
      return;
    }
    const patch = { name };

    const updatedRequestGroup = await models.requestGroup.update(
      originalRequestGroup,
      patch,
    );
    this.setState({ requestGroup: updatedRequestGroup });
  }

  async _handleDescriptionChange(description: string) {
    if (!this.state.requestGroup) {
      return;
    }
    const requestGroup = await models.requestGroup.update(
      this.state.requestGroup,
      {
        description,
      },
    );
    this.setState({ requestGroup, defaultPreviewMode: false });
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
    const { activeWorkspaceIdToCopyTo, requestGroup } = this.state;
    if (!requestGroup || !activeWorkspaceIdToCopyTo) {
      return;
    }

    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);
    if (!workspace) {
      return;
    }

    // TODO: if there are gRPC requests in a request group
    //  we should also copy the protofiles to the destination workspace - INS-267

    await models.requestGroup.duplicate(requestGroup, {
      metaSortKey: -1e9,
      parentId: activeWorkspaceIdToCopyTo,
      name: requestGroup.name, // Because duplicating will add (Copy) suffix
    });

    await models.requestGroup.remove(requestGroup);

    this.setState({ justMoved: true });
    setTimeout(() => {
      this.setState({ justMoved: false });
    }, 2000);
  }

  async _handleCopyToWorkspace() {
    const { activeWorkspaceIdToCopyTo, requestGroup } = this.state;
    if (!requestGroup || !activeWorkspaceIdToCopyTo) {
      return;
    }

    const workspace = await models.workspace.getById(activeWorkspaceIdToCopyTo);
    if (!workspace) {
      return;
    }

    const patch = {
      metaSortKey: -1e9, // Move to top of sort order
      name: requestGroup.name, // Because duplicate will add (Copy) suffix if name is not provided in patch
      parentId: activeWorkspaceIdToCopyTo,
    };

    await models.requestGroup.duplicate(requestGroup, patch);

    this.setState({ justCopied: true });
    setTimeout(() => {
      this.setState({ justCopied: false });
    }, 2000);

    models.stats.incrementCreatedRequests();
  }

  async show({
    requestGroup,
    forceEditMode,
  }: RequestGroupSettingsModalOptions) {
    const { workspacesForActiveProject } = this.props;

    const hasDescription = !!requestGroup.description;

    // Find workspaces for use with moving workspace
    const ancestors = await db.withAncestors(requestGroup);
    const doc = ancestors.find(doc => doc.type === models.workspace.type);
    const workspaceId = doc ? doc._id : 'should-never-happen';
    const workspace = workspacesForActiveProject.find(w => w._id === workspaceId);

    this.setState(
      {
        requestGroup,
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

  _renderDescription() {
    const {
    } = this.props;

    const { showDescription, defaultPreviewMode, requestGroup } = this.state;

    if (!requestGroup) {
      return null;
    }

    return showDescription ? (
      <MarkdownEditor
        ref={this._editorRef}
        className="margin-top"
        defaultPreviewMode={defaultPreviewMode}
        placeholder="Write a description"
        defaultValue={requestGroup.description}
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

  _renderMoveCopy() {
    const { workspacesForActiveProject } = this.props;

    const {
      activeWorkspaceIdToCopyTo,
      justMoved,
      justCopied,
      workspace,
      requestGroup,
    } = this.state;

    if (!requestGroup) {
      return null;
    }

    return (
      <div className="form-row">
        <div className="form-control form-control--outlined">
          <label>
            Move/Copy to Workspace
            <HelpTooltip position="top" className="space-left">
              Copy or move the current folder to a new workspace. It will be
              placed at the root of the new workspace's folder structure.
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
    const { requestGroup } = this.state;

    if (!requestGroup) {
      return null;
    }

    return (
      <div>
        <div className="form-control form-control--outlined">
          <label>
            Name
            <DebouncedInput
              delay={500}
              // @ts-expect-error -- TSCONVERSION props expand into an input but are difficult to type
              type="text"
              placeholder={requestGroup.name || 'My Folder'}
              defaultValue={requestGroup.name}
              onChange={this._handleNameChange}
            />
          </label>
        </div>
        {this._renderDescription()}
        <hr />
        {this._renderMoveCopy()}
      </div>
    );
  }

  render() {
    const { requestGroup } = this.state;
    return (
      <Modal ref={this._setModalRef} freshState>
        <ModalHeader>
          Folder Settings{' '}
          <span className="txt-sm selectable faint monospace">
            {requestGroup ? requestGroup._id : ''}
          </span>
        </ModalHeader>
        <ModalBody className="pad">{this.renderModalBody()}</ModalBody>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  workspacesForActiveProject: selectWorkspacesForActiveProject(state),
});

export const RequestGroupSettingsModal = connect(
  mapStateToProps,
  null,
  null,
  { forwardRef: true },
)(UnconnectedRequestGroupSettingsModal);
