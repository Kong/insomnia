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
import PromptButton from '../base/prompt-button';
import FileInputButton from '../base/file-input-button';
import { showError } from './index';
import fs from 'fs';
import path from 'path';

type Props = {|
  workspace: Workspace,
|};

type State = {|
  protoFiles: Array<ProtoFile>,
  selectedProtoFileId: string,
|};

type ProtoFilesModalOptions = {|
  preselectProtoFileId?: string,
  onSave: string => Promise<void>,
|};

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
    this.onSave = options.onSave;
    this.setState({ ...INITIAL_STATE, selectedProtoFileId: options.preselectProtoFileId });

    this.modal && this.modal.show();
    await this._refresh();
  }

  async _refresh() {
    const { workspace } = this.props;
    const protoFilesForWorkspace = await models.protoFile.findByParentId(workspace._id);

    this.setState({ protoFiles: protoFilesForWorkspace });
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

  _handleDelete(protoFile: ProtoFile) {
    // TODO: to be built in INS-209
    console.log(`delete ${protoFile._id}`);
  }

  async _handleProtoFileUpload(filePath: string) {
    const { workspace } = this.props;

    try {
      const protoText = fs.readFileSync(filePath, 'utf-8');
      const name = path.basename(filePath);
      const newFile = await models.protoFile.create({ name, parentId: workspace._id, protoText });
      this.setState({ selectedProtoFileId: newFile._id });
      await this._refresh();
    } catch (e) {
      showError({ error: e });
    }
  }

  render() {
    const { protoFiles, selectedProtoFileId } = this.state;

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
