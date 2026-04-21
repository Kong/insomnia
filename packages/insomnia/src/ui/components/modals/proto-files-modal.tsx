import * as protoLoader from '@grpc/proto-loader';
import React, { type FC, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';

import type { ProtoDirectory, ProtoFile } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';

import { type ChangeBufferEvent, database as db } from '../../../common/database';
import { selectFileOrFolder } from '../../../common/select-file-or-folder';
import { Modal, type ModalHandle } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { type ExpandedProtoDirectory, ProtoFileList } from '../proto-file/proto-file-list';
import { AsyncButton } from '../themed-button';
import { showError, showModal } from '.';
import { AlertModal } from './alert-modal';

const { isProtoDirectory } = models.protoDirectory;
const { isProtoFile } = models.protoFile;

interface ProtoDirectoryImportResult {
  createdDir: ProtoDirectory | null;
  createdIds: string[];
  error: Error | null;
}

const tryToSelectFilePath = async () => {
  try {
    const { filePath, canceled } = await selectFileOrFolder({ itemTypes: ['file'], extensions: ['proto'] });
    if (!canceled && filePath) {
      return filePath;
    }
  } catch (error) {
    showError({ error });
  }
  return;
};
const tryToSelectFolderPath = async () => {
  try {
    const { filePath, canceled } = await selectFileOrFolder({ itemTypes: ['directory'], extensions: ['proto'] });
    if (!canceled && filePath) {
      return filePath;
    }
  } catch (error) {
    showError({ error });
  }
  return;
};
const isProtofileValid = async (filePath: string) => {
  try {
    await protoLoader.load(filePath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    return true;
  } catch (error) {
    showError({
      title: 'Invalid Proto File',
      message: `The file ${filePath} could not be parsed`,
      error,
    });
    return false;
  }
};

const traverseDirectory = (
  dir: ProtoDirectory,
  files: ProtoFile[],
  directories: ProtoDirectory[],
): ExpandedProtoDirectory => ({
  dir,
  files: files.filter(pf => pf.parentId === dir._id),
  subDirs: directories
    .filter(pd => pd.parentId === dir._id)
    .map(subDir => traverseDirectory(subDir, files, directories)),
});

const getProtoDirectories = async (workspaceId: string) => {
  const allFiles = await services.protoFile.all();
  const allDirs = await services.protoDirectory.all();

  // Get directories where the parent is the workspace
  const rootDirs = await services.protoDirectory.findByParentId(workspaceId);
  // Expand each directory
  const expandedDirs = rootDirs.map(dir => traverseDirectory(dir, allFiles, allDirs));
  // Get files where the parent is the workspace
  const individualFiles = await services.protoFile.findByParentId(workspaceId);
  if (individualFiles.length) {
    return [
      {
        files: individualFiles,
        dir: null,
        subDirs: [],
      },
      ...expandedDirs,
    ];
  }

  return expandedDirs;
};

const createProtoFileFromPath = async (filePath: string, parentId: string, createdIds: string[]) => {
  const fileName = window.path.basename(filePath);
  if (!fileName.toLowerCase().endsWith('.proto')) {
    return false;
  }

  const protoText = await window.main.insecureReadFile({ path: filePath });
  const { _id } = await services.protoFile.create({
    name: fileName,
    parentId,
    protoText,
  });
  createdIds.push(_id);
  return true;
};

const createProtoDirectoryFromPath = async (
  dirPath: string,
  parentId: string,
  createdIds: string[],
): Promise<ProtoDirectory | null> => {
  const entries = await window.main.readDir({ path: dirPath });
  const newDirId = models.protoDirectory.createId();
  let filesFound = false;

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryHasProtoFiles = await (entry.type === 'directory'
      ? createProtoDirectoryFromPath(entry.path, newDirId, createdIds).then(Boolean)
      : createProtoFileFromPath(entry.path, newDirId, createdIds));

    filesFound = filesFound || entryHasProtoFiles;
  }

  if (!filesFound) {
    return null;
  }

  const createdProtoDir = await services.protoDirectory.create({
    _id: newDirId,
    name: window.path.basename(dirPath),
    parentId,
  });
  createdIds.push(createdProtoDir._id);
  return createdProtoDir;
};

const importProtoDirectory = async (dirPath: string, workspaceId: string): Promise<ProtoDirectoryImportResult> => {
  const createdIds: string[] = [];

  try {
    const createdDir = await createProtoDirectoryFromPath(dirPath, workspaceId, createdIds);
    return {
      createdDir,
      createdIds,
      error: null,
    };
  } catch (error) {
    return {
      createdDir: null,
      createdIds,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};

export interface Props {
  defaultId?: string;
  onSave?: (arg0: string) => Promise<void>;
  onHide: () => void;
  reloadRequests: (requestIds: string[]) => void;
}

export const ProtoFilesModal: FC<Props> = ({ defaultId, onHide, onSave }) => {
  const modalRef = useRef<ModalHandle>(null);
  const { workspaceId } = useParams() as { workspaceId: string; requestId: string };

  const [selectedId, setSelectedId] = useState(defaultId);
  const [protoDirectories, setProtoDirectories] = useState<ExpandedProtoDirectory[]>([]);

  useEffect(() => modalRef.current?.show(), []);

  useEffect(() => {
    const fn = async () => {
      setProtoDirectories(await getProtoDirectories(workspaceId));
    };
    fn();
  }, [workspaceId]);

  useEffect(() => {
    const unsubscribe = window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [, doc] = change;
        if (isProtoFile(doc) || isProtoDirectory(doc)) {
          setProtoDirectories(await getProtoDirectories(workspaceId));
        }
      }
    });
    return () => {
      unsubscribe();
    };
  }, [workspaceId]);

  const handleAddDirectory = async () => {
    let rollback = false;
    let createdIds: string[] = [];
    const bufferId = await db.bufferChangesIndefinitely();
    const filePath = await tryToSelectFolderPath();
    if (!filePath) {
      return;
    }
    try {
      const result = await importProtoDirectory(filePath, workspaceId);
      createdIds = result.createdIds;
      const { error, createdDir } = result;

      if (error) {
        showError({
          title: 'Failed to import',
          message: `An unexpected error occurred when reading ${filePath}`,
          error,
        });
        rollback = true;
        return;
      }

      // Show warning if no files found
      if (!createdDir) {
        showModal(AlertModal, {
          title: 'No files found',
          message: `No .proto files were found under ${filePath}.`,
        });
        return;
      }

      // Try parse all loaded proto files to make sure they are valid
      const loadedEntities = await db.getWithDescendants(createdDir);
      const loadedFiles = loadedEntities.filter(isProtoFile);

      for (const protoFile of loadedFiles) {
        try {
          await window.main.grpc.writeProtoFile(protoFile._id);
        } catch (error) {
          showError({
            title: 'Invalid Proto File',
            message: `The file ${protoFile.name} could not be parsed`,
            error,
          });
          rollback = true;
          return;
        }
      }
    } catch (error) {
      rollback = true;
      showError({ error });
    } finally {
      // Fake flushing changes (or, rollback) only prevents change notifications being sent to the UI
      // It does NOT revert changes written to the database, as is typical of a db transaction rollback
      // As such, if rolling back, the created directory needs to be deleted manually
      await db.flushChanges(bufferId, rollback);

      if (rollback) {
        const dirs = await db.find('ProtoDirectory', {
          _id: {
            $in: createdIds,
          },
        });
        for (const dir of dirs) {
          await db.unsafeRemove(dir);
        }
        const files = await db.find('ProtoFile', {
          _id: {
            $in: createdIds,
          },
        });
        for (const file of files) {
          await db.unsafeRemove(file);
        }
      }
    }
  };
  const handleUpdate = async (protoFile: ProtoFile) => {
    const filePath = await tryToSelectFilePath();
    if (!filePath) {
      return;
    }
    if (!(await isProtofileValid(filePath))) {
      return;
    }
    // allow to read the file as it is chosen by user
    const protoText = await window.main.insecureReadFile({ path: filePath });

    const updatedFile = await services.protoFile.update(protoFile, {
      name: window.path.basename(filePath),
      protoText,
    });
    const impacted = await services.grpcRequest.findByProtoFileId(updatedFile._id);
    const requestIds = impacted.map(g => g._id);
    if (requestIds?.length) {
      requestIds.forEach(async requestId => window.main.grpc.cancel(requestId));
    }
  };

  const handleDeleteDirectory = (protoDirectory: ProtoDirectory) => {
    showModal(AlertModal, {
      title: `Delete ${protoDirectory.name}`,
      message: (
        <span>
          Really delete <strong>{protoDirectory.name}</strong> and all proto files contained within? All requests that
          use these proto files will stop working.
        </span>
      ),
      addCancel: true,
      onConfirm: async () => {
        services.protoDirectory.remove(protoDirectory);
        setSelectedId('');
      },
    });
  };
  const handleDeleteFile = (protoFile: ProtoFile) => {
    showModal(AlertModal, {
      title: `Delete ${protoFile.name}`,
      message: (
        <span>
          Really delete <strong>{protoFile.name}</strong>? All requests that use this proto file will stop working.
        </span>
      ),
      addCancel: true,
      onConfirm: () => {
        services.protoFile.remove(protoFile);
        if (selectedId === protoFile._id) {
          setSelectedId('');
        }
      },
    });
  };
  const handleAddFile = async () => {
    const filePath = await tryToSelectFilePath();
    if (!filePath) {
      return;
    }
    if (!(await isProtofileValid(filePath))) {
      return;
    }
    // allow to read the file as it is chosen by user
    const protoText = await window.main.insecureReadFile({ path: filePath });

    const newFile = await services.protoFile.create({
      name: window.path.basename(filePath),
      parentId: workspaceId,
      protoText,
    });
    setSelectedId(newFile._id);
  };

  return (
    <Modal ref={modalRef} onHide={onHide}>
      <ModalHeader>Select Proto File</ModalHeader>
      <ModalBody className="wide pad">
        <div className="row-spaced margin-bottom bold">
          Files
          <span>
            <AsyncButton
              className="margin-right-sm"
              onClick={handleAddDirectory}
              loadingNode={<i className="fa fa-spin fa-refresh" />}
            >
              Add Directory
            </AsyncButton>
            <AsyncButton onClick={handleAddFile} loadingNode={<i className="fa fa-spin fa-refresh" />}>
              Add Proto File
            </AsyncButton>
          </span>
        </div>
        <ProtoFileList
          protoDirectories={protoDirectories}
          selectedId={selectedId}
          handleSelect={id => setSelectedId(id)}
          handleUnselect={() => setSelectedId('')}
          handleUpdate={handleUpdate}
          handleDelete={handleDeleteFile}
          handleDeleteDirectory={handleDeleteDirectory}
        />
      </ModalBody>
      <ModalFooter>
        <div>
          <button
            className="btn"
            onClick={event => {
              event.preventDefault();
              if (typeof onSave === 'function') {
                onSave(selectedId || '');
              }
            }}
          >
            Save
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
};
