import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import type { GitLogEntry, GitVCS } from '../../../sync/git/git-vcs';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { TimeFromNow } from '../time-from-now';
import { Tooltip } from '../tooltip';

type Props = ModalProps & {
  vcs: GitVCS;
};

interface GitLogModalOptions {
  logs: GitLogEntry[];
  branch: string;
}
export interface GitLogModalHandle {
  show: () => void;
  hide: () => void;
}
export const GitLogModal = forwardRef<GitLogModalHandle, Props>(({ vcs }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<GitLogModalOptions>({
    logs: [],
    branch: '??',
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async () => {
      const logs = await vcs.log();
      const branch = await vcs.getBranch();
      setState({ logs, branch });
      modalRef.current?.show();
    },
  }), [vcs]);

  const { logs, branch } = state;
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Git History ({logs.length})</ModalHeader>
      <ModalBody className="pad">
        <table className="table--fancy table--striped">
          <thead>
            <tr>
              <th className="text-left">Message</th>
              <th className="text-left">When</th>
              <th className="text-left">Author</th>
            </tr>
          </thead>
          <tbody>{logs.map(entry => {
            const {
              commit: { author, message },
              oid,
            } = entry;
            return (
              <tr key={oid}>
                <td>{message}</td>
                <td>
                  <TimeFromNow
                    className="no-wrap"
                    timestamp={author.timestamp * 1000}
                    intervalSeconds={30}
                  />
                </td>
                <td>
                  <Tooltip message={`${author.name} <${author.email}>`} delay={800}>
                    {author.name}
                  </Tooltip>
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          <i className="fa fa-code-fork" /> {branch}
        </div>
        <div>
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Done
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
});
GitLogModal.displayName = 'GitLogModal';
