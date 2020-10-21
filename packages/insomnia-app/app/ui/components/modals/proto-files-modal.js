// @flow
import * as React from 'react';
import * as models from '../../../models';
import type { ProtoFile } from '../../../models/proto-file';
import ModalHeader from '../base/modal-header';
import ModalBody from '../base/modal-body';
import ModalFooter from '../base/modal-footer';
import autobind from 'autobind-decorator';
import { ListGroup, ListGroupItem } from 'insomnia-components';
import type { Workspace } from '../../../models/workspace';
import styled from 'styled-components';

type Props = {|
  workspace: Workspace,
|};

type State = {|
  protoFiles: Array<ProtoFile>,
  selectedProtoFileId: string,
|};

type ProtoFilesModalOptions = {|
  preselectProtoFileId?: string,
  onSave?: string => void,
|};

const SelectableListItem: React.PureComponent<{ selected?: boolean }> = styled(ListGroupItem)`
  &:hover {
    background-color: var(--hl-sm) !important;
  }

  background-color: ${props => props.selected && 'var(--hl-sm) !important'};
`;

@autobind
class ProtoFilesModal extends React.PureComponent<Props, State> {
  modal: Modal | null;

  constructor(props: Props) {
    super(props);

    this.state = {
      protoFiles: [],
      selectedProtoFileId: '',
    };
  }

  _setModalRef(n: React.Component<*> | null) {
    this.modal = n;
  }

  async show(options: ProtoFilesModalOptions) {
    this.onSave = options.onSave || null;
    this.setState({ selectedProtoFileId: options.preselectProtoFileId });

    this.modal && this.modal.show();
    await this._refresh(options.preselectProtoFileId);
  }

  async _refresh(preselectProtoFileId?: string) {
    const { workspaceId } = this.props;
    const protofilesForWorkspace = await models.protoFile.findByParentId(workspaceId);

    this.setState({ protoFiles: protofilesForWorkspace });
  }

  async _handleSave() {
    this.hide();

    if (typeof this.onSave === 'function') {
      this.onSave(this.state.selectedProtoFileId);
    }
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderProtofile(p: ProtoFile) {
    const { selectedProtoFileId } = this.state;

    return (
      <SelectableListItem key={p._id} selected={p._id === selectedProtoFileId}>
        <div className="row-spaced">
          {p.name}
          <div>Delete</div>
        </div>
      </SelectableListItem>
    );
  }

  render() {
    const { protoFiles } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Select Protofile</ModalHeader>
        <ModalBody className="wide pad">
          Files
          <ListGroup>
            {!protoFiles.length && (
              <ListGroupItem>No proto files exist for this workspace</ListGroupItem>
            )}
            {protoFiles.map(this.renderProtofile)}
          </ListGroup>
        </ModalBody>
        <ModalFooter>
          <div>
            <button className="btn" onClick={this._handleSave}>
              Save
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default ProtoFilesModal;
