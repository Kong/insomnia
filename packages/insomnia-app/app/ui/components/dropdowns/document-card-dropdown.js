// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import { showError, showModal, showPrompt } from '../modals';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { ApiSpec } from '../../../models/api-spec';
import { parseApiSpec } from '../../../common/api-specs';
import Strings from '../../../common/strings';
import * as db from '../../../common/database';
import * as models from '../../../models';
import AskModal from '../modals/ask-modal';
import type { Workspace } from '../../../models/workspace';
import { getAppName } from '../../../common/constants';

type Props = {
  apiSpec: ?ApiSpec,
  children: ?React.Node,
  workspace: Workspace,
  handleSetActiveWorkspace: (workspaceId: string) => void,
  isLastWorkspace: boolean,
  className?: string,
};

type State = {
  actionPlugins: Array<DocumentAction>,
  loadingActions: { [string]: boolean },
};

@autobind
class DocumentCardDropdown extends React.PureComponent<Props, State> {
  state = {
    actionPlugins: [],
    loadingActions: {},
  };

  _handleDuplicate() {
    const { apiSpec, workspace, handleSetActiveWorkspace } = this.props;
    const { fileName } = apiSpec;

    showPrompt({
      title: `Duplicate ${Strings.apiSpec}`,
      defaultValue: fileName,
      submitName: 'Create',
      selectText: true,
      label: 'New Name',
      onComplete: async newName => {
        const newWorkspace = await db.duplicate(workspace, { name: newName });
        await models.apiSpec.updateOrCreateForParentId(newWorkspace._id, { fileName: newName });

        handleSetActiveWorkspace(newWorkspace._id);
      },
    });
  }

  _handleRename() {
    const { apiSpec } = this.props;

    showPrompt({
      title: `Rename ${Strings.apiSpec}`,
      defaultValue: apiSpec.fileName,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: async fileName => {
        await models.apiSpec.update(apiSpec, { fileName });
      },
    });
  }

  _handleDelete() {
    const { apiSpec, workspace, isLastWorkspace } = this.props;

    const messages = [
      `Do you really want to delete "${apiSpec.fileName}"?`,
      isLastWorkspace
        ? ` This is the only ${Strings.apiSpec.toLowerCase()} so a new one will be created for you.`
        : null,
    ];

    showModal(AskModal, {
      title: `Delete ${Strings.apiSpec}`,
      message: messages.join(' '),
      yesText: 'Yes',
      noText: 'Cancel',
      onDone: async isYes => {
        if (!isYes) {
          return;
        }

        if (isLastWorkspace) {
          await models.workspace.create({ name: getAppName(), scope: 'spec' });
        }
        await models.workspace.remove(workspace);
      },
    });
  }

  async _onOpen() {
    const plugins = await getDocumentActions();
    this.setState({ actionPlugins: plugins });
  }

  async _handlePluginClick(p: DocumentAction) {
    this.setState(state => ({
      loadingActions: {
        ...state.loadingActions,
        [p.label]: true,
      },
    }));

    try {
      const { apiSpec } = this.props;

      const context = {
        ...pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER),
        ...pluginContexts.data.init(),
        ...pluginContexts.store.init(p.plugin),
      };

      await p.action(context, parseApiSpec(apiSpec.contents));
    } catch (err) {
      showError({
        title: 'Document Action Failed',
        error: err,
      });
    }

    this.setState(state => ({ loadingActions: { ...state.loadingActions, [p.label]: false } }));
    this._dropdown && this._dropdown.hide();
  }

  render() {
    const {
      children,
      workspaceId,
      className,
      handleDuplicateWorkspaceById,
      handleRenameWorkspaceById,
      handleDeleteWorkspaceById,
      ...extraProps
    } = this.props;

    const { actionPlugins, loadingActions } = this.state;

    return (
      <Dropdown beside onOpen={this._onOpen} {...extraProps}>
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
