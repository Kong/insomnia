// @flow
import * as React from 'react';
import * as models from '../../../models';
import type { ProtoFile } from '../../../models/proto-file';
import ModalHeader from '../base/modal-header';
import ModalBody from '../base/modal-body';
import ModalFooter from '../base/modal-footer';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../../models/workspace';
import Modal from '../base/modal';
import ProtoFileList from '../proto-file/proto-file-list';
import FileInputButton from '../base/file-input-button';
import { showAlert, showError } from './index';
import fs from 'fs';
import path from 'path';

type Props = {|
  workspace: Workspace,
  protoFiles: Array<ProtoFile>,
|};

type State = {|
  selectedProtoFileId: string,
|};

type ProtoFilesModalOptions = {|
  preselectProtoFileId?: string,
  onSave: string => Promise<void>,
|};

const INITIAL_STATE: State = {
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
    this.onSave = options.onSave;
    this.setState({ selectedProtoFileId: options.preselectProtoFileId });

    this.modal && this.modal.show();
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

  _handleSelect(id: string) {
    this.setState({ selectedProtoFileId: id });
  }

  async _handleDelete(protoFile: ProtoFile) {
    showAlert({
      title: `Delete ${protoFile.name}`,
      message: (
        <span>
          Really delete <strong>{protoFile.name}</strong>? All requests that use this proto file
          will stop working.
        </span>
      ),
      addCancel: true,
      onConfirm: async () => {
        await models.protoFile.remove(protoFile);

        // if the deleted protoFile was previously selected, clear the selection
        if (this.state.selectedProtoFileId === protoFile._id) {
          this.setState({ selectedProtoFileId: '' });
        }
      },
    });
  }

  async _handleProtoFileUpload(filePath: string) {
    const { workspace } = this.props;

    try {
      const protoText = fs.readFileSync(filePath, 'utf-8');
      const name = path.basename(filePath);
      const newFile = await models.protoFile.create({ name, parentId: workspace._id, protoText });
      this.setState({ selectedProtoFileId: newFile._id });
    } catch (e) {
      showError({ error: e });
    }
  }

  async _handleRename(protoFile: ProtoFile, name: string): Promise<void> {
    await models.protoFile.update(protoFile, { name });
  }

  render() {
    const { protoFiles } = this.props;
    const { selectedProtoFileId } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Select Protofile</ModalHeader>
        <ModalBody className="wide pad">
          <div className="row-spaced">
            Files
            <FileInputButton
              name=".proto file"
              showFileIcon
              extensions={['.proto']}
              className="btn btn--clicky"
              onChange={this._handleProtoFileUpload}
            />
          </div>
          <ProtoFileList
            protoFiles={protoFiles}
            selectedId={selectedProtoFileId}
            handleSelect={this._handleSelect}
            handleDelete={this._handleDelete}
            handleRename={this._handleRename}
          />
        </ModalBody>
        <ModalFooter>
          <div>
            <button className="btn" onClick={this._handleSave} disabled={!selectedProtoFileId}>
              Save
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

export default ProtoFilesModal;
