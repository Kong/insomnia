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
import { showAlert, showError } from './index';
import fs from 'fs';
import path from 'path';
import selectFileOrFolder from '../../../common/select-file-or-folder';
import { AsyncButton } from 'insomnia-components';
import type { GrpcDispatch } from '../../context/grpc';
import { grpcActions, sendGrpcIpcMultiple } from '../../context/grpc';
import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import * as protoLoader from '../../../network/grpc/proto-loader';
import { connect } from 'react-redux';
import type { ExpandedProtoDirectory } from '../../redux/proto-selectors';
import { selectExpandedActiveProtoDirectories } from '../../redux/proto-selectors';
import * as db from '../../../common/database';

type Props = {|
  grpcDispatch: GrpcDispatch,
  workspace: Workspace,
  protoDirectories: Array<ExpandedProtoDirectory>,
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

const spinner = <i className="fa fa-spin fa-refresh" />;

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

  _handleAdd(): Promise<void> {
    return this._handleUpload();
  }

  async _handleAddDirectory(): Promise<void> {
    const { workspace } = this.props;

    const bufferId = await db.bufferChanges();
    try {
      // Select file
      const { filePath, canceled } = await selectFileOrFolder({
        itemTypes: ['directory'],
        extensions: ['proto'],
      });

      // Exit if no file selected
      if (canceled || !filePath) {
        return;
      }

      // Create root dir in database
      console.log(filePath);
      const rootDir = await models.protoDirectory.create({
        name: path.basename(filePath),
        parentId: workspace._id,
      });
      console.log(rootDir.name);

      // Read contents
      const dirents = await fs.promises.readdir(filePath, { withFileTypes: true });

      // Loop and read all entries
      await Promise.all(
        dirents.map(async entry => {
          if (entry.isDirectory()) {
            console.log('nested dir');
          } else {
            const readFile = path.resolve(filePath, entry.name);
            console.log(readFile);
            const protoText = fs.readFileSync(readFile, 'utf-8');
            const name = entry.name;

            await models.protoFile.create({
              name,
              parentId: rootDir._id,
              protoText,
            });
          }
        }),
      );
      await db.flushChanges(bufferId);
      this.setState({ selectedProtoFileId: null });
    } catch (e) {
      await db.flushChanges(bufferId, true);
      showError({ error: e });
    }
  }

  async _handleUpload(protoFile?: ProtoFile): Promise<void> {
    const { workspace, grpcDispatch } = this.props;

    try {
      // Select file
      const { filePath, canceled } = await selectFileOrFolder({
        itemTypes: ['file', 'directory'],
        extensions: ['proto'],
      });

      // Exit if no file selected
      if (canceled || !filePath) {
        return;
      }

      // Read contents
      const protoText = fs.readFileSync(filePath, 'utf-8');
      const name = path.basename(filePath);

      // Try parse proto file to make sure the file is valid
      try {
        await protoLoader.loadMethodsFromText(protoText);
      } catch (e) {
        showError({
          title: 'Invalid Proto File',
          message: `The file ${filePath} and could not be parsed`,
          error: e,
        });

        return;
      }

      // Create or update a protoFile
      if (protoFile) {
        await models.protoFile.update(protoFile, { name, protoText });
        const action = await grpcActions.invalidateMany(protoFile._id);

        grpcDispatch(action);
        sendGrpcIpcMultiple(GrpcRequestEventEnum.cancelMultiple, action?.requestIds);
      } else {
        const newFile = await models.protoFile.create({ name, parentId: workspace._id, protoText });
        this.setState({ selectedProtoFileId: newFile._id });
      }
    } catch (e) {
      showError({ error: e });
    }
  }

  async _handleRename(protoFile: ProtoFile, name: string): Promise<void> {
    await models.protoFile.update(protoFile, { name });
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
            protoFiles={protoDirectories[0].files}
            selectedId={selectedProtoFileId}
            handleSelect={this._handleSelect}
            handleUpdate={this._handleUpload}
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

const mapStateToProps = (state, props) => {
  const protoDirectories = selectExpandedActiveProtoDirectories(state, props);

  console.log(protoDirectories);
  return { protoDirectories };
};

export default connect(mapStateToProps, null, null, { forwardRef: true })(ProtoFilesModal);
