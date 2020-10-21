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
import Modal from '../base/modal';
import PromptButton from '../base/prompt-button';

type Props = {|
  workspace: Workspace,
|};

type State = {|
  protoFiles: Array<ProtoFile>,
  selectedProtoFileId: string,
|};

type ProtoFilesModalOptions = {|
  preselectProtoFileId?: string,
  onSave?: string => Promise<void>,
|};

const SelectableListItem: React.PureComponent<{ selected?: boolean }> = styled(ListGroupItem)`
  &:hover {
    background-color: var(--hl-sm) !important;
  }

  background-color: ${props => props.selected && 'var(--hl-sm) !important'};
`;

const ProtoFileListItem = (props: {
  protoFile: ProtoFile,
  selected?: boolean,
  onClick: (id: string) => void,
  onDelete: (id: string) => Promise<void>,
  onRename: (id: string, name: string) => Promise<void>,
}) => {
  const { protoFile, selected, onClick, onDelete } = props;
  const { name, _id } = protoFile;

  const onClickCallback = React.useCallback(() => onClick(_id), [onClick, _id]);
  const onDeleteCallback = React.useCallback(
    async (e: SyntheticEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      await onDelete(_id);
    },
    [onDelete, _id],
  );

  return (
    <SelectableListItem selected={selected} onClick={onClickCallback}>
      <div className="row-spaced">
        {name}
        <PromptButton
          className="btn btn--super-compact btn--outlined"
          addIcon
          confirmMessage=""
          onClick={onDeleteCallback}
          title="Delete Proto File">
          <i className="fa fa-trash-o" />
        </PromptButton>
      </div>
    </SelectableListItem>
  );
};

const INITIAL_STATE: State = {
  protoFiles: [],
  selectedProtoFileId: '',
};

@autobind
class ProtoFilesModal extends React.PureComponent<Props, State> {
  modal: Modal | null;
  onSave: (string => Promise<void>) | null;

  constructor(props: Props) {
    super(props);

    this.state = INITIAL_STATE;
    this.onSave = null;
  }

  _setModalRef(ref: ?Modal) {
    this.modal = ref;
  }

  async show(options: ProtoFilesModalOptions) {
    this.onSave = options.onSave || null;
    this.setState({ ...INITIAL_STATE });

    this.modal && this.modal.show();
    await this._refresh(options.preselectProtoFileId);
  }

  async _refresh(preselectProtoFileId?: string) {
    const { workspaceId } = this.props;
    const protoFilesForWorkspace = await models.protoFile.findByParentId(workspaceId);

    protoFilesForWorkspace.push(
      { _id: 'pf_123', name: 'File 1' },
      { _id: 'pf_456', name: 'File 2' },
      { _id: 'pf_789', name: 'File 3' },
    );

    this.setState({
      protoFiles: protoFilesForWorkspace,
      selectedProtoFileId: preselectProtoFileId,
    });
  }

  async _handleSave(e: SyntheticEvent<HTMLButtonElement>) {
    e.preventDefault();
    this.hide();

    if (typeof this.onSave === 'function') {
      await this.onSave(this.state.selectedProtoFileId);
    }
  }

  hide() {
    this.modal && this.modal.hide();
  }

  renderProtofile(p: ProtoFile) {
    const { selectedProtoFileId } = this.state;

    return (
      <ProtoFileListItem
        key={p.id}
        protoFile={p}
        selected={p._id === selectedProtoFileId}
        onClick={id => this.setState({ selectedProtoFileId: id })}
        onDelete={id => console.log(`delete ${id}`)}
        onRename={id => console.log(`rename ${id}`)}
      />
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
