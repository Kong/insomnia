import React, { useEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { useRouteLoaderData } from 'react-router-dom';

import * as session from '../../../account/session';
import { database as db } from '../../../common/database';
import type { Snapshot } from '../../../sync/types';
import { VCS } from '../../../sync/vcs/vcs';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { HelpTooltip } from '../help-tooltip';
import { TimeFromNow } from '../time-from-now';
import { Tooltip } from '../tooltip';
type Props = ModalProps & {
  vcs: VCS;
  branch: string;
  history: Snapshot[];
};

export const SyncHistoryModal = ({ vcs, branch, history, onHide }: Props) => {
  const modalRef = useRef<ModalHandle>(null);

  const {
    syncItems,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  useEffect(() => {
    modalRef.current?.show();
  }, []);
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
  return (
    <OverlayContainer>
      <Modal ref={modalRef} onHide={onHide}>
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
                        await db.batchModifyDocs(delta as any);
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
    </OverlayContainer>
  );
};
