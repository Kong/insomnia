import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { BaseModel } from '../../../models';
import type { DocumentKey, Stage, StageEntry, Status } from '../../../sync/types';
import { describeChanges } from '../../../sync/vcs/util';
import { VCS } from '../../../sync/vcs/vcs';
import { selectSyncItems } from '../../redux/selectors';
import { IndeterminateCheckbox } from '../base/indeterminate-checkbox';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { Tooltip } from '../tooltip';

type Props = ModalProps & {
  vcs: VCS;
};

type LookupMap = Record<string, {
  entry: StageEntry;
  changes: null | string[];
  type: string;
  checked: boolean;
}>;

export interface SyncStagingModalOptions {
  status: Status;
  message: string;
  error: string;
  branch: string;
  lookupMap: LookupMap;
  onSnapshot: () => Promise<void>;
  handlePush: () => Promise<void>;
}

export interface SyncStagingModalHandle {
  show: (options: SyncStagingModalOptions) => void;
  hide: () => void;
}

export const SyncStagingModal = forwardRef<SyncStagingModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const syncItems = useSelector(selectSyncItems);
  const [state, setState] = useState<SyncStagingModalOptions>({
    status: {
      stage: {},
      unstaged: {},
      key: '',
    },
    branch: '',
    error: '',
    message: '',
    lookupMap: {},
    onSnapshot: async () => { },
    handlePush: async () => { },
  });

  const refreshVCS = useCallback(async (newStage: Stage = {}) => {
    const branch = await vcs.getBranch();
    const status = await vcs.status(syncItems, newStage);
    const lookupMap: LookupMap = {};
    const allKeys = [...Object.keys(status.stage), ...Object.keys(status.unstaged)];
    for (const key of allKeys) {
      const lastSnapshot: BaseModel | null = await vcs.blobFromLastSnapshot(key);
      const document = syncItems.find(si => si.key === key)?.document;
      const docOrLastSnapshot = document || lastSnapshot;
      const entry = status.stage[key] || status.unstaged[key];
      const hasStagingChangeAndDoc = entry && docOrLastSnapshot;
      const hasDocAndLastSnapshot = document && lastSnapshot;
      if (hasStagingChangeAndDoc) {
        lookupMap[key] = {
          changes: hasDocAndLastSnapshot ? describeChanges(document, lastSnapshot) : null,
          entry: entry,
          type: models.getModelName(docOrLastSnapshot.type),
          checked: !!status.stage[key],
        };
      }
    }
    setState(state => ({
      ...state,
      status,
      branch,
      lookupMap,
      error: '',
    }));
  }, [syncItems, vcs]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ onSnapshot, handlePush }) => {
      modalRef.current?.show();
      // Reset state
      setState({
        status: {
          stage: {},
          unstaged: {},
          key: '',
        },
        branch: '',
        error: '',
        message: '',
        lookupMap: {},
        onSnapshot,
        handlePush,
      });
      // Add everything to stage by default except new items
      const status: Status = await vcs.status(syncItems, {});
      const toStage: StageEntry[] = [];
      for (const key of Object.keys(status.unstaged)) {
        if ('added' in status.unstaged[key]) {
          // Don't automatically stage added resources
          continue;
        }
        toStage.push(status.unstaged[key]);
      }
      const stage = await vcs.stage(status.stage, toStage);
      await refreshVCS(stage);
    },
  }), [refreshVCS, syncItems, vcs]);

  const handleStageToggle = async (event: React.SyntheticEvent<HTMLInputElement>) => {
    const { status } = state;
    const id = event.currentTarget.name;
    const isStaged = !!status.stage[id];
    const newStage = isStaged
      ? await vcs.unstage(status.stage, [status.stage[id]])
      : await vcs.stage(status.stage, [status.unstaged[id]]);
    await refreshVCS(newStage);
  };

  const handleAllToggle = async (keys: DocumentKey[], doStage: boolean) => {
    const { status } = state;
    let stage;
    if (doStage) {
      const entries: StageEntry[] = [];
      for (const k of Object.keys(status.unstaged)) {
        if (keys.includes(k)) {
          entries.push(status.unstaged[k]);
        }
      }
      stage = await vcs.stage(status.stage, entries);
    } else {
      const entries: StageEntry[] = [];
      for (const k of Object.keys(status.stage)) {
        if (keys.includes(k)) {
          entries.push(status.stage[k]);
        }
      }
      stage = await vcs.unstage(status.stage, entries);
    }
    await refreshVCS(stage);
  };

  const handleTakeSnapshotAndPush = async () => {
    const success = await handleTakeSnapshot();
    if (success) {
      state.handlePush?.();
    }
  };

  const handleTakeSnapshot = async () => {
    const {
      message,
      status: { stage },
      onSnapshot,
    } = state;
    try {
      await vcs.takeSnapshot(stage, message);
    } catch (err) {
      setState(state => ({
        ...state,
        error: err.message,
      }));
      return false;
    }
    onSnapshot?.();
    await refreshVCS();
    setState(state => ({ ...state, message: '', error: '' }));
    modalRef.current?.hide();
    return true;
  };

  const { status, message, error, branch } = state;
  const allMap = { ...status.stage, ...status.unstaged };
  const addedKeys: string[] = Object.entries(allMap)
    .filter(([, value]) => 'added' in value)
    .map(([key]) => key);
  const nonAddedKeys: string[] = Object.entries(allMap)
    .filter(([, value]) => !('added' in value))
    .map(([key]) => key);

  return (
    <Modal ref={modalRef}>
      <ModalHeader>Create Snapshot</ModalHeader>
      <ModalBody className="wide pad">
        {error && (
          <p className="notice error margin-bottom-sm no-margin-top">
            <button className="pull-right icon" onClick={() => setState(state => ({ ...state, error: '' }))}>
              <i className="fa fa-times" />
            </button>
            {error}
          </p>
        )}
        <div className="form-group">
          <div className="form-control form-control--outlined">
            <label>
              Snapshot Message
              <textarea
                cols={30}
                rows={3}
                onChange={event => setState(state => ({ ...state, message: event.target.value }))}
                value={message}
                placeholder="This is a helpful message that describe the changes made in this snapshot"
                required
              />
            </label>
          </div>
        </div>
        <ChangesTable
          keys={nonAddedKeys}
          title='Modified Objects'
          status={status}
          lookupMap={state.lookupMap}
          toggleAll={handleAllToggle}
          toggleOne={handleStageToggle}
        />
        <ChangesTable
          keys={addedKeys}
          title='Unversioned Objects'
          status={status}
          lookupMap={state.lookupMap}
          toggleAll={handleAllToggle}
          toggleOne={handleStageToggle}
        />
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          <i className="fa fa-code-fork" /> {branch}
        </div>
        <div>
          <button className="btn" onClick={handleTakeSnapshot}>
            Create
          </button>
          <button className="btn" onClick={handleTakeSnapshotAndPush}>
            Create and Push
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});

interface OperationTooltipProps {
  entry: StageEntry;
  type: string;
  changes: string[];
}
const OperationTooltip = ({ entry, type, changes }: OperationTooltipProps) => {
  const operationType = type === models.workspace.type ? type = strings.collection.singular : type;
  if ('added' in entry) {
    return (
      <Tooltip message="Added">
        <i className="fa fa-plus-circle success" /> {operationType}
      </Tooltip>
    );
  }
  if ('modified' in entry) {
    return (
      <Tooltip message={`Modified (${changes.join(', ')})`}>
        <i className="fa fa-circle faded" /> {operationType}
      </Tooltip>
    );
  }
  if ('deleted' in entry) {
    return (
      <Tooltip message="Deleted">
        <i className="fa fa-minus-circle danger" /> {operationType}
      </Tooltip>
    );
  }
  return (
    <Tooltip message="Unknown">
      <i className="fa fa-question-circle info" /> {operationType}
    </Tooltip>
  );
};
interface ChangesTableProps {
  keys: DocumentKey[];
  title: string;
  status: Status;
  lookupMap: LookupMap;
  toggleAll: (keys: DocumentKey[], doStage: boolean) => void;
  toggleOne: (event: React.SyntheticEvent<HTMLInputElement>) => void;
}
const ChangesTable = ({
  keys,
  title,
  status,
  lookupMap,
  toggleAll,
  toggleOne,
}: ChangesTableProps) => {
  if (keys.length === 0) {
    return null;
  }
  let allUnChecked = true;
  let allChecked = true;
  for (const key of keys.sort()) {
    if (!status.stage[key]) {
      allChecked = false;
    }
    if (!status.unstaged[key]) {
      allUnChecked = false;
    }
  }
  const indeterminate = !allChecked && !allUnChecked;
  return (
    <div className="pad-top">
      <strong>{title}</strong>
      <table className="table--fancy table--outlined margin-top-sm">
        <thead>
          <tr>
            <th>
              <label className="wide no-pad">
                <span className="txt-md">
                  <IndeterminateCheckbox
                    className="space-right"
                    checked={allChecked}
                    onChange={() => toggleAll(keys, allUnChecked)}
                    indeterminate={indeterminate}
                  />
                </span>{' '}
                name
              </label>
            </th>
            <th className="text-right ">Changes</th>
            <th className="text-right">Description</th>
          </tr>
        </thead>
        <tbody>
          {keys.filter(key => lookupMap[key]).map(key => {
            const { entry, type, checked, changes } = lookupMap[key];
            return (
              <tr key={key} className="table--no-outline-row">
                <td>
                  <label className="no-pad wide">
                    <input
                      className="space-right"
                      type="checkbox"
                      checked={checked}
                      name={key}
                      onChange={toggleOne}
                    />{' '}
                    {entry.name}
                  </label>
                </td>
                <td className="text-right">{changes ? changes.join(', ') : '--'}</td>
                <td className="text-right">
                  <OperationTooltip
                    entry={entry}
                    type={type}
                    changes={changes || []}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
SyncStagingModal.displayName = 'SyncStagingModal';
