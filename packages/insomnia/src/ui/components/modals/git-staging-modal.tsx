import classnames from 'classnames';
import path from 'path';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import YAML from 'yaml';

import { SegmentEvent, trackSegmentEvent, vcsSegmentEventProperties } from '../../../common/analytics';
import { database as db } from '../../../common/database';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { isApiSpec } from '../../../models/api-spec';
import { GitRepository } from '../../../models/git-repository';
import type { Workspace } from '../../../models/workspace';
import { gitRollback } from '../../../sync/git/git-rollback';
import { GIT_INSOMNIA_DIR, GIT_INSOMNIA_DIR_NAME, GitVCS } from '../../../sync/git/git-vcs';
import parseGitPath from '../../../sync/git/parse-git-path';
import { getOauth2FormatName } from '../../../sync/git/utils';
import { IndeterminateCheckbox } from '../base/indeterminate-checkbox';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { Tooltip } from '../tooltip';

interface Item {
  path: string;
  type: string;
  status: string;
  staged: boolean;
  added: boolean;
  editable: boolean;
}

type Props = ModalProps & {
  workspace: Workspace;
  vcs: GitVCS;
  gitRepository: GitRepository | null;
};

export interface GitStagingModalOptions {
  loading: boolean;
  branch: string;
  message: string;
  items: Record<string, Item>;
  onCommit: () => Promise<void>;
  statusNames: Record<string, string>;
}
export interface GitStagingModalHandle {
  show: (options: GitStagingModalOptions) => void;
  hide: () => void;
}
export const GitStagingModal = forwardRef<GitStagingModalHandle, Props>(({ vcs, workspace, gitRepository }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<GitStagingModalOptions>({
    loading: false,
    branch: '',
    message: '',
    items: {},
    onCommit: async () => { },
    statusNames: {},
  });

  const getAllPaths = useCallback(async (): Promise<string[]> => {
    // @ts-expect-error -- TSCONVERSION
    const f = vcs.getFs().promises;
    const fsPaths: string[] = [];
    for (const type of await f.readdir(GIT_INSOMNIA_DIR)) {
      const typeDir = path.join(GIT_INSOMNIA_DIR, type);
      for (const name of await f.readdir(typeDir)) {
        // NOTE: git paths don't start with '/' so we're omitting
        //  it here too.
        const gitPath = path.join(GIT_INSOMNIA_DIR_NAME, type, name);
        fsPaths.push(path.join(gitPath));
      }
    }
    // To get all possible paths, we need to combine the paths already in Git
    // with the paths on the FS. This is required to cover the case where a
    // file can be deleted from FS or from Git.
    const gitPaths = await vcs.listFiles();
    const uniquePaths = new Set([...fsPaths, ...gitPaths]);
    return Array.from(uniquePaths).sort();
  }, [vcs]);

  const refresh = useCallback(async () => {
    setState(state => ({ ...state, loading: true }));
    // Get and set branch name
    const branch = await vcs.getBranch();
    setState(state => ({ ...state, branch }));
    // Cache status names
    const docs = await db.withDescendants(workspace);
    const allPaths = await getAllPaths();
    const statusNames: Record<string, string> = {};
    for (const doc of docs) {
      const name = (isApiSpec(doc) && doc.fileName) || doc.name || '';
      statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.json`)] = name;
      statusNames[path.join(GIT_INSOMNIA_DIR_NAME, doc.type, `${doc._id}.yml`)] = name;
    }
    // Create status items
    const items: Record<string, Item> = {};
    const log = (await vcs.log(1)) || [];
    for (const gitPath of allPaths) {
      const status = await vcs.status(gitPath);
      if (status === 'unmodified') {
        continue;
      }
      if (!statusNames[gitPath] && log.length > 0) {
        const docYML = await vcs.readObjFromTree(log[0].commit.tree, gitPath);
        if (docYML) {
          try {
            statusNames[gitPath] = YAML.parse(docYML.toString()).name || '';
          } catch (err) {}
        }
      }
      // We know that type is in the path; extract it. If the model is not found, set to Unknown.
      let { type } = parseGitPath(gitPath);
      // @ts-expect-error -- TSCONVERSION
      if (!models.types().includes(type)) {
        type = 'Unknown';
      }
      const added = status.includes('added');
      let staged = !added;
      let editable = true;
      // We want to enforce that workspace changes are always committed because otherwise
      // others won't be able to clone from it. We also make fundamental migrations to the
      // scope property which need to be committed.
      // So here we're preventing people from un-staging the workspace.
      if (type === models.workspace.type) {
        editable = false;
        staged = true;
      }
      items[gitPath] = {
        type: type as any,
        staged,
        editable,
        status,
        added,
        path: gitPath,
      };
    }
    setState(state => ({
      ...state,
      items,
      loading: false,
      statusNames,
    }));
  }, [getAllPaths, vcs, workspace]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async ({ onCommit }) => {
      modalRef.current?.show();
      // Reset state
      setState({
        loading: false,
        branch: '',
        message: '',
        items: {},
        statusNames: {},
        onCommit,
      });
      refresh();
    },
  }), [refresh]);

  const toggleAll = async (items: Item[], forceAdd = false) => {
    const allStaged = items.every(i => i.staged);
    const doStage = !allStaged;
    const newItems = { ...state.items };
    for (const { path: p } of items) {
      if (newItems[p].editable) {
        newItems[p].staged = doStage || forceAdd;
      }
    }
    const providerName = getOauth2FormatName(gitRepository?.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', doStage ? 'stage_all' : 'unstage_all'), providerName });
    setState(state => ({ ...state, items: newItems }));
  };

  const handleToggleOne = async (event: React.SyntheticEvent<HTMLInputElement>) => {
    const newItems = { ...state.items };
    const gitPath = event.currentTarget.name;
    if (!newItems[gitPath] || !newItems[gitPath].editable) {
      return;
    }
    newItems[gitPath].staged = !newItems[gitPath].staged;
    const providerName = getOauth2FormatName(gitRepository?.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', newItems[gitPath].staged ? 'stage' : 'unstage'), providerName });
    setState(state => ({ ...state, items: newItems }));
  };

  const handleRollback = async (items: Item[]) => {
    const files = items
      .filter(i => i.editable) // only rollback if editable
      .map(i => ({
        filePath: i.path,
        status: i.status,
      }));
    await gitRollback(vcs, files);
    refresh();
  };

  const handleRollbackSingle = (item: Item) => {
    handleRollback([item]);
    const providerName = getOauth2FormatName(gitRepository?.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'rollback'), providerName });
  };

  const handleRollbackAll = (items: Item[]) => {
    handleRollback(items);
    const providerName = getOauth2FormatName(gitRepository?.credentials);
    trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'rollback_all'), providerName });
  };
  const { items, branch, loading, statusNames, message, onCommit } = state;
  const hasChanges = !!Object.values(items).length;
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Commit Changes</ModalHeader>
      <ModalBody className="wide pad">
        {hasChanges ? <>
          <div className="form-control form-control--outlined">
            <textarea
              rows={3}
              required
              placeholder="A descriptive message to describe changes made"
              defaultValue={state.message}
              onChange={event => setState({ ...state, message: event.target.value })}
            />
          </div>
          <ChangesTable
            title="Modified Objects"
            rollbackLabel='Rollback all'
            items={Object.values(items).filter(i => !i.status.includes('added'))}
            statusNames={statusNames}
            rollbackAll={handleRollbackAll}
            rollbackOne={handleRollbackSingle}
            toggleAll={toggleAll}
            toggleOne={handleToggleOne}
          />
          <ChangesTable
            title="Unversioned Objects"
            rollbackLabel='Delete all'
            items={Object.values(items).filter(i => i.status.includes('added'))}
            statusNames={statusNames}
            rollbackAll={handleRollbackAll}
            rollbackOne={handleRollbackSingle}
            toggleAll={toggleAll}
            toggleOne={handleToggleOne}
          />
        </>
          : state.loading ? <>Loading...</> : <>No changes to commit.</>}
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          <i className="fa fa-code-fork" /> {branch}{' '}
          {loading && <i className="fa fa-refresh fa-spin" />}
        </div>
        <div>
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Close
          </button>
          <button
            className="btn"
            onClick={async () => {
              for (const item of Object.values(items)) {
                if (item.staged) {
                  item.status.includes('deleted') ? await vcs.remove(item.path) : await vcs.add(item.path);
                }
              }
              await vcs.commit(message);
              const providerName = getOauth2FormatName(gitRepository?.credentials);
              trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'commit'), providerName });
              modalRef.current?.hide();
              if (typeof onCommit === 'function') {
                onCommit();
              }
            }}
            disabled={loading || !hasChanges}
          >
            Commit
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
GitStagingModal.displayName = 'GitStagingModal';

const OperationTooltip = ({ item }: { item: Item }) => {
  const type = item.type === models.workspace.type ? strings.document.singular : item.type;
  if (item.status.includes('added')) {
    return (
      <Tooltip message="Added">
        <i className="fa fa-plus-circle success" /> {type}
      </Tooltip>
    );
  }
  if (item.status.includes('modified')) {
    return (
      <Tooltip message="Modified">
        <i className="fa fa-plus-circle faded" /> {type}
      </Tooltip>
    );
  }
  if (item.status.includes('deleted')) {
    return (
      <Tooltip message="Deleted">
        <i className="fa fa-minus-circle danger" /> {type}
      </Tooltip>
    );
  }
  return (
    <Tooltip message="Unknown">
      <i className="fa fa-question-circle info" /> {type}
    </Tooltip>
  );
};
interface ChangeTableProps {
  items: Item[];
  title: string;
  rollbackLabel: string;
  statusNames: Record<string, string>;
  rollbackAll: (items: Item[]) => void;
  rollbackOne: (item: Item) => void;
  toggleAll: (items: Item[], forceAdd: boolean) => void;
  toggleOne: (event: React.SyntheticEvent<HTMLInputElement>) => void;
}
const ChangesTable = ({
  items,
  title,
  rollbackLabel,
  statusNames,
  rollbackAll,
  rollbackOne,
  toggleAll,
  toggleOne,
}: ChangeTableProps) => {
  if (items.length === 0) {
    return null;
  }
  const allStaged = items.every(i => i.staged);
  const allUnstaged = items.every(i => !i.staged);
  return (
    <div className="pad-top">
      <strong>{title}</strong>
      <PromptButton
        className="btn pull-right btn--micro"
        onClick={() => rollbackAll(items)}
      >
        {rollbackLabel}
      </PromptButton>
      <table className="table--fancy table--outlined margin-top-sm">
        <thead>
          <tr className="table--no-outline-row">
            <th>
              <label className="wide no-pad">
                <span className="txt-md">
                  <IndeterminateCheckbox
                    className="space-right"
                    // @ts-expect-error -- TSCONVERSION
                    type="checkbox"
                    checked={allStaged}
                    onChange={() => toggleAll(items, !allStaged)}
                    indeterminate={!allStaged && !allUnstaged}
                  />
                </span>{' '}
                name
              </label>
            </th>
            <th className="text-right">Description</th>
          </tr>
        </thead>
        <tbody>{items.map(item => (
          <tr key={item.path} className="table--no-outline-row">
            <td>
              <label className="no-pad wide">
                <input
                  disabled={!item.editable}
                  className="space-right"
                  type="checkbox"
                  checked={item.staged}
                  name={item.path}
                  onChange={toggleOne}
                />{' '}
                {statusNames?.[item.path] || 'n/a'}
              </label>
            </td>
            <td className="text-right">
              {item.editable && <Tooltip message={item.added ? 'Delete' : 'Rollback'}>
                <button
                  className="btn btn--micro space-right"
                  onClick={() => rollbackOne(item)}
                >
                  <i className={classnames('fa', item.added ? 'fa-trash' : 'fa-undo')} />
                </button>
              </Tooltip>}
              <OperationTooltip item={item} />
            </td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
};
