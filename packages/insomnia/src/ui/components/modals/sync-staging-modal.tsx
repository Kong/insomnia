import React, { useEffect, useState } from 'react';
import { Button, Dialog, Heading, Label, Modal, ModalOverlay, TextArea, TextField } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { all } from '../../../models';
import type { Status, StatusCandidate } from '../../../sync/types';
import { VCS } from '../../../sync/vcs/vcs';
import { Icon } from '../icon';

interface Props {
  vcs: VCS;
  branch: string;
  status: Status;
  syncItems: StatusCandidate[];
  onClose: () => void;
}

function getModelTypeById(id: string) {
  const idPrefix = id.split('_')[0];
  const model = all().find(model => model.prefix === idPrefix);

  return model?.name || 'Unknown';
}

export const SyncStagingModal = ({ onClose, status, syncItems }: Props) => {
  const { projectId, workspaceId, organizationId } = useParams() as {
    projectId: string;
    workspaceId: string;
    organizationId: string;
  };

  const [checkAllModified, setCheckAllModified] = useState(true);
  const [checkAllUnversioned, setCheckAllUnversioned] = useState(false);

  const stagedChanges = Object.entries(status.stage);
  const unstagedChanges = Object.entries(status.unstaged);

  const allChanges = [...stagedChanges, ...unstagedChanges].map(([key, entry]) => ({
    ...entry,
    document: syncItems.find(item => item.key === key)?.document || 'deleted' in entry ? { type: getModelTypeById(key) } : undefined,
  }));

  const unversionedChanges = allChanges.filter(change => 'added' in change);
  const modifiedChanges = allChanges.filter(change => !('added' in change));

  const { Form, formAction, state, data } = useFetcher();

  const isPushing = state !== 'idle' && formAction?.endsWith('create-snapshot-and-push');
  const isCreatingSnapshot = state !== 'idle' && formAction?.endsWith('create-snapshot');

  useEffect(() => {
    if (allChanges.length === 0) {
      onClose();
    }
  }, [allChanges, onClose]);

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal className="max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
        <Dialog
          onClose={onClose}
          className="outline-none"
        >
          {({ close }) => (
            <div className='flex flex-col gap-4'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading className='text-2xl'>Create snapshot</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <Form
                method="POST"
                className='flex flex-col gap-2'
              >
                <TextField className="flex flex-col gap-2">
                  <Label className='font-bold'>
                    Snapshot message
                  </Label>
                  <TextArea
                    rows={3}
                    name="message"
                    className="border border-solid border-[--hl-sm] rounded-sm p-2 resize-none"
                    placeholder="This is a helpful message that describes the changes made in this snapshot"
                    required
                  />
                </TextField>
                {modifiedChanges.length > 0 && (
                  <div className="pad-top">
                    <strong>Modified objects</strong>
                    <table className="table--fancy table--outlined margin-top-sm">
                      <thead>
                        <tr className="table--no-outline-row">
                          <th>
                            <label className="wide no-pad">
                              <span className="txt-md">
                                <input
                                  className="space-right"
                                  type="checkbox"
                                  checked={checkAllModified}
                                  name="allModified"
                                  onChange={() =>
                                    setCheckAllModified(!checkAllModified)
                                  }
                                />
                              </span>{' '}
                              name
                            </label>
                          </th>
                          <th className="text-right">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modifiedChanges.map(item => (
                          <tr key={item.key} className="table--no-outline-row">
                            <td>
                              <label className="no-pad wide">
                                <input
                                  className="space-right"
                                  type="checkbox"
                                  {...(checkAllModified
                                    ? { checked: true }
                                    : {})}
                                  value={item.key}
                                  name="keys"
                                />{' '}
                                {item.name || 'n/a'}
                              </label>
                            </td>
                            <td className="text-right">
                              <div className='flex items-center gap-2 justify-end'>
                                <Icon className={'deleted' in item ? 'text-[--color-danger]' : 'added' in item ? 'text-[--color-success]' : ''} icon={'deleted' in item ? 'minus-circle' : 'added' in item ? 'plus-circle' : 'file-edit'} />
                                {item.document?.type}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {unversionedChanges.length > 0 && (
                  <div className="pad-top">
                    <strong>Unversioned objects</strong>
                    <table className="table--fancy table--outlined margin-top-sm">
                      <thead>
                        <tr className="table--no-outline-row">
                          <th>
                            <label className="wide no-pad">
                              <span className="txt-md">
                                <input
                                  className="space-right"
                                  type="checkbox"
                                  checked={checkAllUnversioned}
                                  name="allModified"
                                  onChange={() =>
                                    setCheckAllUnversioned(!checkAllUnversioned)
                                  }
                                />
                              </span>{' '}
                              name
                            </label>
                          </th>
                          <th className="text-right">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unversionedChanges.map(item => (
                          <tr key={item.key} className="table--no-outline-row">
                            <td>
                              <label className="no-pad wide">
                                <input
                                  className="space-right"
                                  type="checkbox"
                                  {...(checkAllUnversioned
                                    ? { checked: true }
                                    : {})}
                                  value={item.key}
                                  name="keys"
                                />{' '}
                                {item.name || 'n/a'}
                              </label>
                            </td>
                            <td className="text-right">
                              <div className='flex items-center gap-2 justify-end'>
                                <Icon className={'deleted' in item ? 'text-[--color-danger]' : 'added' in item ? 'text-[--color-success]' : ''} icon={'deleted' in item ? 'minus-circle' : 'added' in item ? 'plus-circle' : 'file-edit'} />
                                {item.document?.type}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data?.error && (
                  <div>
                    <p className="notice error margin-top-sm">
                      {data.error}
                    </p>
                  </div>
                )}
                <div className="flex justify-end gap-2 items-center">
                  <Button
                    type='submit'
                    isDisabled={state !== 'idle'}
                    formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot`}
                    className="hover:no-underline flex items-center gap-2 hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                  >
                    <Icon icon={isCreatingSnapshot ? 'spinner' : 'plus'} className={`w-5 ${isCreatingSnapshot ? 'animate-spin' : ''}`} /> Create
                  </Button>
                  <Button
                    type="submit"
                    isDisabled={state !== 'idle'}
                    formAction={`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/branch/create-snapshot-and-push`}
                    className="hover:no-underline flex items-center gap-2 bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                  >
                    <Icon icon={isPushing ? 'spinner' : 'cloud-arrow-up'} className={`w-5 ${isPushing ? 'animate-spin' : ''}`} /> Create and push
                  </Button>
                </div>
              </Form>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
