import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import * as session from '../../../account/session';
import type { Snapshot } from '../../../sync/types';
import { VCS } from '../../../sync/vcs/vcs';
import { selectSyncItems } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { TimeFromNow } from '../time-from-now';
import { Tooltip } from '../tooltip';

type Props = ModalProps & {
  vcs: VCS;
};
interface State {
  branch: string;
  history: Snapshot[];
}
export interface SyncHistoryModalHandle {
  show: () => void;
  hide: () => void;
}
export const SyncHistoryModal = forwardRef<SyncHistoryModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    branch: '',
    history: [],
  });
  const syncItems = useSelector(selectSyncItems);
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async () => {
      const branch = await vcs.getBranch();
      const history = await vcs.getHistory();
      setState({
        branch,
        history: history.sort((a, b) => (a.created < b.created ? 1 : -1)),
      });
      modalRef.current?.show();
    },
  }), [vcs]);

  const authorName = (snapshot: Snapshot) => {
    let fullName = '';
    if (snapshot.authorAccount) {
      const { firstName, lastName } = snapshot.authorAccount;
      fullName += `${firstName} ${lastName}`;
    }
    if (snapshot.author === session.getAccountId()) {
      fullName += ' (you)';
    }

    return fullName;
  };
  const { branch, history } = state;
  return (
    <Modal ref={modalRef}>
      <ModalHeader>
        Branch History: <i>{branch}</i>
      </ModalHeader>
      <ModalBody className="wide pad">
        <table className="table--fancy table--striped">
          <thead>
            <tr>
              <th className="text-left">Message</th>
              <th className="text-left">When</th>
              <th className="text-left">Author</th>
              <th className="text-right">Objects</th>
              <th className="text-right">
                Restore
                <HelpTooltip>
                  This will revert the workspace to that state stored in the snapshot
                </HelpTooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {history.map(snapshot => (
              <tr key={snapshot.id}>
                <td>
                  <Tooltip message={snapshot.id} selectable wide delay={500}>
                    {snapshot.name}
                  </Tooltip>
                </td>
                <td>
                  <TimeFromNow
                    className="no-wrap"
                    timestamp={snapshot.created}
                    intervalSeconds={30}
                  />
                </td>
                <td className="text-left">{Boolean(authorName(snapshot)) ? (
                  <>
                    {authorName(snapshot)}{' '}
                    <HelpTooltip
                      info
                      // @ts-expect-error -- TSCONVERSION
                      delay={500}
                    >
                      {snapshot.authorAccount?.email || ''}
                    </HelpTooltip>
                  </>
                ) : '--'}</td>
                <td className="text-right">{snapshot.state.length}</td>
                <td className="text-right">
                  <PromptButton
                    className="btn btn--micro btn--outlined"
                    onClick={async () => {
                      const delta = await vcs.rollback(snapshot.id, syncItems);
                      // @ts-expect-error -- TSCONVERSION
                      await db.batchModifyDocs(delta);
                    }}
                  >
                    Restore
                  </PromptButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ModalBody>
    </Modal>
  );
});
SyncHistoryModal.displayName = 'SyncHistoryModal';
