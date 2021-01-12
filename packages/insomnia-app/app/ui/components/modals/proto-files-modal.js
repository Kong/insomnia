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
import type { ProtoDirectory } from '../../../models/proto-directory';

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

  async _handleDeleteDirectory(protoDirectory: ProtoDirectory) {
    showAlert({
      title: `Delete ${protoDirectory.name}`,
      message: (
        <span>
          Really delete <strong>{protoDirectory.name}</strong> and all proto files contained within?
          All requests that use these proto files will stop working.
        </span>
      ),
      addCancel: true,
      onConfirm: async () => {
        const descendant = await db.withDescendants(protoDirectory);
        await models.protoDirectory.remove(protoDirectory);

        // if previously selected protofile has been deleted, clear the selection
        if (descendant.find(c => c._id === this.state.selectedProtoFileId)) {
          this.setState({ selectedProtoFileId: '' });
        }
      },
    });
  }

  _handleAdd(): Promise<void> {
    return this._handleUpload();
  }

  // TODO: Move this out of the modal class component
  async _readDir(dirPath: string, dirParentId: string): Promise<Array<boolean>> {
    // Create dir in database
    const createdProtoDir = await models.protoDirectory.create({
      name: path.basename(dirPath),
      parentId: dirParentId,
    });

    // Read contents
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    // Loop and read all entries
    const filesFound = await Promise.all(
      entries.map(async entry => {
        const fullEntryPath = path.resolve(dirPath, entry.name);
        if (entry.isDirectory()) {
          // Is directory
          const result = await this._readDir(fullEntryPath, createdProtoDir._id);
          return result.some(c => c);
        } else {
          // Is file
          const extension = path.extname(entry.name);

          // Only load .proto files
          if (extension === '.proto') {
            // TODO: use fs.promises api
            const protoText = fs.readFileSync(fullEntryPath, 'utf-8');
            const name = entry.name;

            await models.protoFile.create({
              name,
              parentId: createdProtoDir._id,
              protoText,
            });
            return true;
          }
        }
      }),
    );

    // Delete the directory if no .proto file is found in a nested location
    if (!filesFound.some(c => c)) {
      await models.protoDirectory.remove(createdProtoDir);
    }

    return filesFound;
  }

  // TODO: Move this out of the modal class component
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

      const filesFound = await this._readDir(filePath, workspace._id);

      // Show warning if no files found
      if (!filesFound.some(c => c)) {
        showAlert({
          title: 'No files found',
          message: `No .proto files were found under ${filePath}.`,
        });
      }

      // TODO: validate the change is correct

      await db.flushChanges(bufferId);
    } catch (e) {
      await db.flushChanges(bufferId, true);
      showError({ error: e });
    }
  }

  // TODO: Move this out of the modal class component
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
        await protoLoader.loadMethodsFromPath(filePath);
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
            protoDirectories={protoDirectories}
            selectedId={selectedProtoFileId}
            handleSelect={this._handleSelect}
            handleUpdate={this._handleUpload}
            handleDelete={this._handleDelete}
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
  const protoDirectories = selectExpandedActiveProtoDirectories(state, props);

  return { protoDirectories };
};

export default connect(mapStateToProps, null, null, { forwardRef: true })(ProtoFilesModal);
