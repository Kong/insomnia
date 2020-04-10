// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import { showError, showModal } from '../modals';
import PortalUploadModal from '../modals/portal-upload-modal';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { ApiSpec } from '../../../models/api-spec';
import { parseApiSpec } from '../../../common/api-specs';

type Props = {
  apiSpec: ?ApiSpec,
  children: ?React.Node,
  handleDuplicateWorkspaceById: (workspaceId: string) => any,
  handleRenameWorkspaceById: (workspaceId: string) => any,
  handleDeleteWorkspaceById: (workspaceId: string) => any,
  className?: string,
};

type State = {
  actionPlugins: Array<DocumentAction>,
  loadingActions: {[string]: boolean},
}

@autobind
class DocumentCardDropdown extends React.PureComponent<Props, State> {
  state = {
    actionPlugins: [],
    loadingActions: {},
  };

  _handleDuplicateWorkspace() {
    const { workspaceId, handleDuplicateWorkspaceById } = this.props;
    handleDuplicateWorkspaceById(() => null, workspaceId);
  }

  _handleRenameWorkspace() {
    const { workspaceId, handleRenameWorkspaceById } = this.props;
    handleRenameWorkspaceById(() => null, workspaceId);
  }

  _handleDeleteWorkspaceBy() {
    const { workspaceId, handleDeleteWorkspaceById } = this.props;
    handleDeleteWorkspaceById(() => null, workspaceId);
  }

  _handleDeployPortal() {
    const { workspaceId } = this.props;
    showModal(PortalUploadModal, { workspaceId });
  }

  async _onOpen() {
    const plugins = await getDocumentActions();
    this.setState({ actionPlugins: plugins });
  }

  async _handlePluginClick(p: DocumentAction) {
    this.setState(state => ({
      loadingActions: {
        ...state.loadingActions, [p.label]: true,
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

    const {
      actionPlugins,
      loadingActions,
    } = this.state;

    return (
      <Dropdown beside onOpen={this._onOpen} {...extraProps}>
        <DropdownButton className={className}>
          {children}
        </DropdownButton>

        <DropdownItem onClick={this._handleDeployPortal}>
          Deploy to portal
        </DropdownItem>
        <DropdownItem onClick={this._handleDuplicateWorkspace}>
          Duplicate
        </DropdownItem>
        <DropdownItem onClick={this._handleRenameWorkspace}>
          Rename
        </DropdownItem>

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
        <DropdownItem className="danger" onClick={this._handleDeleteWorkspaceBy}>
          Delete
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default DocumentCardDropdown;
