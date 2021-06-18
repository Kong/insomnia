import React, { PureComponent } from 'react';
import type { ProtoFile } from '../../../models/proto-file';
import ModalHeader from '../base/modal-header';
import ModalBody from '../base/modal-body';
import ModalFooter from '../base/modal-footer';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { Workspace } from '../../../models/workspace';
import Modal from '../base/modal';
import ProtoFileList from '../proto-file/proto-file-list';
import { AsyncButton } from 'insomnia-components';
import type { GrpcDispatch } from '../../context/grpc';
import { grpcActions, sendGrpcIpcMultiple } from '../../context/grpc';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import { connect } from 'react-redux';
import type { ExpandedProtoDirectory } from '../../redux/proto-selectors';
import { selectExpandedActiveProtoDirectories } from '../../redux/proto-selectors';
import type { ProtoDirectory } from '../../../models/proto-directory';
import * as protoManager from '../../../network/grpc/proto-manager';

interface Props {
  grpcDispatch: GrpcDispatch;
  workspace: Workspace;
  protoDirectories: ExpandedProtoDirectory[];
}

interface State {
  selectedProtoFileId: string;
}

interface ProtoFilesModalOptions {
  preselectProtoFileId?: string;
  onSave: (arg0: string) => Promise<void>;
}

const INITIAL_STATE: State = {
  selectedProtoFileId: '',
};

const spinner = <i className="fa fa-spin fa-refresh" />;

@autoBindMethodsForReact(AUTOBIND_CFG)
class ProtoFilesModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  onSave: ((arg0: string) => Promise<void>) | null;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
    this.onSave = null;
  }

  _setModalRef(ref: Modal) {
    this.modal = ref;
  }

  async show(options: ProtoFilesModalOptions) {
    this.onSave = options.onSave;
    this.setState({
      selectedProtoFileId: options.preselectProtoFileId || '',
    });
    this.modal && this.modal.show();
  }

  async _handleSave(e: React.SyntheticEvent<HTMLButtonElement>) {
    e.preventDefault();
    this.hide();

    if (typeof this.onSave === 'function' && this.state.selectedProtoFileId) {
      await this.onSave(this.state.selectedProtoFileId);
    }
  }

  hide() {
    this.modal && this.modal.hide();
  }

  _handleSelect(id: string) {
    this.setState({
      selectedProtoFileId: id,
    });
  }

  _handleDeleteFile(protoFile: ProtoFile) {
    return protoManager.deleteFile(protoFile, deletedId => {
      // if the deleted protoFile was previously selected, clear the selection
      if (this.state.selectedProtoFileId === deletedId) {
        this.setState({
          selectedProtoFileId: '',
        });
      }
    });
  }

  _handleDeleteDirectory(protoDirectory: ProtoDirectory) {
    return protoManager.deleteDirectory(protoDirectory, deletedIds => {
      // if previously selected protoFile has been deleted, clear the selection
      if (deletedIds.includes(this.state.selectedProtoFileId)) {
        this.setState({
          selectedProtoFileId: '',
        });
      }
    });
  }

  _handleAdd() {
    return protoManager.addFile(this.props.workspace._id, createdId => {
      this.setState({
        selectedProtoFileId: createdId,
      });
    });
  }

  _handleUpload(protoFile: ProtoFile) {
    const { grpcDispatch } = this.props;
    return protoManager.updateFile(protoFile, async updatedId => {
      const action = await grpcActions.invalidateMany(updatedId);
      grpcDispatch(action);
      sendGrpcIpcMultiple(GrpcRequestEventEnum.cancelMultiple, action?.requestIds);
    });
  }

  _handleAddDirectory() {
    return protoManager.addDirectory(this.props.workspace._id);
  }

  _handleRename(protoFile: ProtoFile, name: string) {
    return protoManager.renameFile(protoFile, name);
  }

  render() {
    const { protoDirectories } = this.props;
    const { selectedProtoFileId } = this.state;
    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Select Proto File</ModalHeader>
        <ModalBody className="wide pad">
          <div className="row-spaced margin-bottom bold">
            Files
            <span>
              <AsyncButton
                className="margin-right-sm"
                onClick={this._handleAddDirectory}
                loadingNode={spinner}>
                Add Directory
              </AsyncButton>
              <AsyncButton onClick={this._handleAdd} loadingNode={spinner}>
                Add Proto File
              </AsyncButton>
            </span>
          </div>
          <ProtoFileList
            protoDirectories={protoDirectories}
            selectedId={selectedProtoFileId}
            handleSelect={this._handleSelect}
            handleUpdate={this._handleUpload}
            handleDelete={this._handleDeleteFile}
            handleRename={this._handleRename}
            handleDeleteDirectory={this._handleDeleteDirectory}
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

const mapStateToProps = (state, props) => {
  // @ts-expect-error -- TSCONVERSION
  const protoDirectories = selectExpandedActiveProtoDirectories(state, props);
  return {
    protoDirectories,
  };
};

export default connect(mapStateToProps, null, null, {
  forwardRef: true,
})(ProtoFilesModal);
