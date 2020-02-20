// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownButton, DropdownItem, DropdownDivider } from '../base/dropdown';

type Props = {
  children: ?React.Node,
  handleDuplicateWorkspaceById: Function,
  handleRenameWorkspace: Function,
  handleDeleteWorkspaceById: Function,
  className?: string,
};

@autobind
class DocumentCardDropdown extends React.PureComponent<Props> {
  _handleDuplicateWorkspace(id) {
    this.props.handleDuplicateWorkspaceById(() => {}, this.props.workspaceId);
  }

  _handleRenameWorkspace(id) {
    this.props.handleRenameWorkspace((ws) => {}, id);
  }

  _handleDeleteWorkspaceById(id) {
    this.props.handleDeleteWorkspaceById((ws) => {}, id);
  }

  render() {
    const { children, workspaceId, className, ...extraProps } = this.props;
    return (
      <Dropdown beside {...extraProps}>
        <DropdownButton className={className}>{children}</DropdownButton>
        <DropdownItem className="txt-lg" onClick={this._handleDuplicateWorkspace}>Duplicate</DropdownItem>
        <DropdownItem className="txt-lg" onClick={() => this._handleRenameWorkspace(workspaceId)}>Rename</DropdownItem>
        <DropdownDivider>
        </DropdownDivider>
        <DropdownItem className="txt-lg" onClick={() => this._handleDeleteWorkspaceById(workspaceId)}><span className="danger">Delete</span></DropdownItem>
      </Dropdown>
    );
  }
}

export default DocumentCardDropdown;
