import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import type { MergeConflict } from '../../../sync/types';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
export interface SyncMergeModalOptions {
  conflicts?: MergeConflict[];
  handleDone?: (conflicts?: MergeConflict[]) => void;
}
export interface SyncMergeModalHandle {
  show: (options: SyncMergeModalOptions) => void;
  hide: () => void;
}
export const SyncMergeModal = forwardRef<SyncMergeModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<SyncMergeModalOptions>({
    conflicts: [],
  });

  useImperativeHandle(ref, () => ({
    hide: () => modalRef.current?.hide(),
    show: ({ conflicts, handleDone }) => {
      setState({
        conflicts,
        handleDone,
      });
      modalRef.current?.show();
    },
  }), []);

  const { conflicts, handleDone } = state;

  return (
    <Modal ref={modalRef}>
      <ModalHeader key="header">Resolve Conflicts</ModalHeader>
      <ModalBody key="body" className="pad text-center" noScroll>
        <table className="table--fancy table--outlined">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th
                style={{
                  width: '10rem',
                }}
              >
                Choose
              </th>
            </tr>
          </thead>
          <tbody>
            {conflicts?.length && conflicts.map(conflict => (
              <tr key={conflict.key}>
                <td className="text-left">{conflict.name}</td>
                <td className="text-left">{conflict.message}</td>
                <td className="no-wrap">
                  <label className="no-pad">
                    Mine{' '}
                    <input
                      type="radio"
                      value={conflict.mineBlob || ''}
                      checked={conflict.choose === conflict.mineBlob}
                      onChange={event => setState({
                        ...state,
                        conflicts: conflicts.map(c => c.key !== conflict.key ? c : { ...c, choose: event.target.value || null }),
                      })}
                    />
                  </label>
                  <label className="no-pad margin-left">
                    Theirs{' '}
                    <input
                      type="radio"
                      value={conflict.theirsBlob || ''}
                      checked={conflict.choose === conflict.theirsBlob}
                      onChange={event => setState({
                        ...state,
                        conflicts: conflicts.map(c => c.key !== conflict.key ? c : { ...c, choose: event.target.value || null }),
                      })}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ModalBody>
      <ModalFooter>
        <button
          className="btn"
          onClick={() => {
            handleDone?.(conflicts);
            modalRef.current?.hide();
          }}
        >
          Submit Resolutions
        </button>
      </ModalFooter>
    </Modal >
  );
});
SyncMergeModal.displayName = 'SyncMergeModal';
