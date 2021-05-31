import React, { PureComponent, ReactNode } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG, getAppName } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import { showError, showModal, showPrompt } from '../modals';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { ApiSpec } from '../../../models/api-spec';
import { parseApiSpec } from '../../../common/api-specs';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models';
import AskModal from '../modals/ask-modal';
import type { Workspace } from '../../../models/workspace';
import getWorkspaceName from '../../../models/helpers/get-workspace-name';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { WorkspaceScopeKeys } from '../../../models/workspace';

interface Props {
  apiSpec?: ApiSpec | null;
  children?: ReactNode | null;
  workspace: Workspace;
  handleSetActiveWorkspace: (workspaceId: string) => void;
  isLastWorkspace: boolean;
  className?: string;
}

interface State {
  actionPlugins: DocumentAction[];
  loadingActions: Record<string, boolean>;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class DocumentCardDropdown extends PureComponent<Props, State> {
  state: State = {
    actionPlugins: [],
    loadingActions: {},
  };

  _handleDuplicate() {
    const { apiSpec, workspace, handleSetActiveWorkspace } = this.props;
    showPrompt({
      title: `Duplicate ${getWorkspaceLabel(workspace).singular}`,
      // @ts-expect-error -- TSCONVERSION
      defaultValue: getWorkspaceName(workspace, apiSpec),
      submitName: 'Create',
      selectText: true,
      label: 'New Name',
      onComplete: async newName => {
        const newWorkspace = workspaceOperations.duplicate(workspace, newName);
        // @ts-expect-error -- TSCONVERSION
        handleSetActiveWorkspace(newWorkspace._id);
      },
    });
  }

  _handleRename() {
    const { apiSpec, workspace } = this.props;
    showPrompt({
      title: `Rename ${getWorkspaceLabel(workspace).singular}`,
      // @ts-expect-error -- TSCONVERSION
      defaultValue: getWorkspaceName(workspace, apiSpec),
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: async name => {
        // @ts-expect-error -- TSCONVERSION
        await workspaceOperations.rename(workspace, apiSpec, name);
      },
    });
  }

  _handleDelete() {
    const { apiSpec, workspace, isLastWorkspace } = this.props;
    const label = getWorkspaceLabel(workspace);
    const messages = [
      // @ts-expect-error -- TSCONVERSION
      `Do you really want to delete "${getWorkspaceName(workspace, apiSpec)}"?`,
      isLastWorkspace
        ? ` This is the only ${label.singular.toLowerCase()} so a new one will be created for you.`
        : null,
    ];
    showModal(AskModal, {
      title: `Delete ${label}`,
      message: messages.join(' '),
      yesText: 'Yes',
      noText: 'Cancel',
      onDone: async isYes => {
        if (!isYes) {
          return;
        }

        if (isLastWorkspace) {
          // Create a new workspace and default scope to designer
          await models.workspace.create({
            name: getAppName(),
            scope: WorkspaceScopeKeys.design,
          });
        }

        await models.stats.incrementDeletedRequestsForDescendents(workspace);
        await models.workspace.remove(workspace);
      },
    });
  }

  async _onOpen() {
    // Only load document plugins if the scope is designer, for now
    if (this.props.workspace.scope === WorkspaceScopeKeys.design) {
      const plugins = await getDocumentActions();
      this.setState({
        actionPlugins: plugins,
      });
    }
  }

  async _handlePluginClick(p: DocumentAction) {
    this.setState(state => ({
      loadingActions: { ...state.loadingActions, [p.label]: true },
    }));

    try {
      const { apiSpec } = this.props;
      const context = {
        ...pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER),
        ...pluginContexts.data.init(),
        ...pluginContexts.store.init(p.plugin),
      };
      // @ts-expect-error -- TSCONVERSION
      await p.action(context, parseApiSpec(apiSpec.contents));
    } catch (err) {
      showError({
        title: 'Document Action Failed',
        error: err,
      });
    }

    this.setState(state => ({
      loadingActions: { ...state.loadingActions, [p.label]: false },
    }));
    // @ts-expect-error -- TSCONVERSION appears to be genuine
    this._dropdown?.hide();
  }

  render() {
    const { children, className } = this.props;
    const { actionPlugins, loadingActions } = this.state;
    return (
      <Dropdown beside onOpen={this._onOpen}>
        <DropdownButton className={className}>{children}</DropdownButton>

        <DropdownItem onClick={this._handleDuplicate}>Duplicate</DropdownItem>
        <DropdownItem onClick={this._handleRename}>Rename</DropdownItem>

        {/* Render actions from plugins */}
        {actionPlugins.map((p: DocumentAction) => (
          <DropdownItem
            key={p.label}
            onClick={() => this._handlePluginClick(p)}
            stayOpenAfterClick={!p.hideAfterClick}>
            {loadingActions[p.label] && <i className="fa fa-refresh fa-spin" />}
            {p.label}
          </DropdownItem>
        ))}

        <DropdownDivider />
        <DropdownItem className="danger" onClick={this._handleDelete}>
          Delete
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default DocumentCardDropdown;
