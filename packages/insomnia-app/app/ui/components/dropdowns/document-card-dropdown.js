// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownItem, DropdownDivider } from '../base/dropdown';
import { showModal } from '../modals';
import PortalUploadModal from '../modals/portal-upload-modal';

type Props = {
  children: ?React.Node,
  handleDuplicateWorkspaceById: (workspaceId: string) => any,
  handleRenameWorkspaceById: (workspaceId: string) => any,
  handleDeleteWorkspaceById: (workspaceId: string) => any,
  className?: string,
};

@autobind
class DocumentCardDropdown extends React.PureComponent<Props> {
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

    return (
      <Dropdown beside {...extraProps}>
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
        <DropdownDivider/>
        <DropdownItem className="danger" onClick={this._handleDeleteWorkspaceBy}>
          Delete
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default DocumentCardDropdown;
