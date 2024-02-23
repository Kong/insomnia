import React, { useEffect } from 'react';
import { Button, Cell, Checkbox, Column, Dialog, Heading, Label, Modal, ModalOverlay, Row, Table, TableBody, TableHeader, TextArea, TextField } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { all } from '../../../models';
import type { Status, StatusCandidate } from '../../../sync/types';
import { Icon } from '../icon';

interface Props {
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

  const stagedChanges = Object.entries(status.stage);
  const unstagedChanges = Object.entries(status.unstaged);

  const allChanges = [...stagedChanges, ...unstagedChanges].map(([key, entry]) => ({
    ...entry,
    document: syncItems.find(item => item.key === key)?.document || 'deleted' in entry ? { type: getModelTypeById(key) } : undefined,
  }));

  const unversionedChanges = allChanges.filter(change => 'added' in change);
  const modifiedChanges = allChanges.filter(change => !('added' in change));

  const { Form, formAction, state, data } = useFetcher();
  const error = data?.error;

  const isPushing = state !== 'idle' && formAction?.endsWith('create-snapshot-and-push');
  const isCreatingSnapshot = state !== 'idle' && formAction?.endsWith('create-snapshot');

  useEffect(() => {
    if (allChanges.length === 0 && !error) {
      onClose();
    }
  }, [allChanges, onClose, error]);

  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex flex-col max-w-4xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
      >
        <Dialog
          className="outline-none flex-1 h-full flex flex-col overflow-hidden"
        >
          {({ close }) => (
            <div className='flex-1 flex flex-col gap-4 overflow-hidden'>
              <div className='flex-shrink-0 flex gap-2 items-center justify-between'>
                <Heading className='text-2xl'>Create commit</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <Form
                method="POST"
                className='flex-1 flex flex-col gap-4 overflow-hidden'
              >
                <TextField className="flex flex-col gap-2 flex-shrink-0">
                  <Label className='font-bold'>
                    Commit message
                  </Label>
                  <TextArea
                    rows={3}
                    name="message"
                    className="border border-solid border-[--hl-sm] rounded-sm p-2 resize-none"
                    placeholder="This is a helpful message that describes the changes made in this snapshot"
                    required
                  />
                </TextField>

                <div className='grid auto-rows-auto gap-2 overflow-y-auto'>
                  {modifiedChanges.length > 0 && (
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96'>
                      <Heading className='font-semibold flex-shrink-0'>Modified Objects</Heading>
                      <div className='flex-1 overflow-y-auto rounded w-full border border-solid border-[--hl-sm] select-none'>
                        <Table
                          selectionMode='multiple'
                          defaultSelectedKeys="all"
                          aria-label='Modified objects'
                          className="border-separate border-spacing-0 w-full"
                        >
                          <TableHeader>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              <Checkbox slot="selection" className="group p-0 flex items-center h-full">
                                <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
                                  <Icon icon='check' className='opacity-0 group-data-[selected]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
                                </div>
                              </Checkbox>
                            </Column>
                            <Column isRowHeader className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Name
                            </Column>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-right text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Description
                            </Column>
                          </TableHeader>
                          <TableBody
                            className="divide divide-[--hl-sm] divide-solid"
                            items={
                              modifiedChanges.map(item => ({
                                ...item,
                                id: item.key,
                              }))
                            }
                          >
                            {item => (
                              <Row className="group focus:outline-none focus-within:bg-[--hl-xxs] transition-colors">
                                <Cell className="relative whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='p-2'>
                                    <Checkbox slot="selection" name="keys" value={item.key} className="group p-0 flex items-center h-full">
                                      <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
                                        <Icon icon='check' className='opacity-0 group-data-[selected]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
                                      </div>
                                    </Checkbox>
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='p-2'>
                                    {item.name}
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='flex items-center gap-2 justify-end p-2'>
                                    <Icon className={'deleted' in item ? 'text-[--color-danger]' : 'added' in item ? 'text-[--color-success]' : ''} icon={'deleted' in item ? 'minus-circle' : 'added' in item ? 'plus-circle' : 'circle'} />
                                    {item.document?.type}
                                  </div>
                                </Cell>
                              </Row>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {unversionedChanges.length > 0 && (
                    <div className='flex flex-col gap-2 overflow-hidden max-h-96'>
                      <Heading className='font-semibold flex-shrink-0'>Unversioned Objects</Heading>
                      <div className='flex-1 overflow-y-auto rounded w-full border border-solid border-[--hl-sm] select-none'>
                        <Table
                          selectionMode='multiple'
                          aria-label='Unversioned objects'
                          className="border-separate border-spacing-0 w-full"
                        >
                          <TableHeader>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              <Checkbox slot="selection" className="group p-0 flex items-center h-full">
                                <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
                                  <Icon icon='check' className='opacity-0 group-data-[selected]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
                                </div>
                              </Checkbox>
                            </Column>
                            <Column isRowHeader className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Name
                            </Column>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-right text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Description
                            </Column>
                          </TableHeader>
                          <TableBody
                            className="divide divide-[--hl-sm] divide-solid"
                            items={
                              unversionedChanges.map(item => ({
                                ...item,
                                name: item.name || 'n/a',
                                id: item.key,
                              }))
                            }
                          >
                            {item => (
                              <Row className="group focus:outline-none focus-within:bg-[--hl-xxs] transition-colors">
                                <Cell className="relative whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='p-2'>
                                    <Checkbox slot="selection" name="keys" value={item.key} className="group p-0 flex items-center h-full">
                                      <div className="w-4 h-4 rounded flex items-center justify-center transition-colors group-data-[selected]:bg-[--hl-xs] group-focus:ring-2 ring-1 ring-[--hl-sm]">
                                        <Icon icon='check' className='opacity-0 group-data-[selected]:opacity-100 group-data-[selected]:text-[--color-success] w-3 h-3' />
                                      </div>
                                    </Checkbox>
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='p-2'>
                                    {item.name}
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='flex items-center gap-2 justify-end p-2'>
                                    <Icon className={'deleted' in item ? 'text-[--color-danger]' : 'added' in item ? 'text-[--color-success]' : ''} icon={'deleted' in item ? 'minus-circle' : 'added' in item ? 'plus-circle' : 'circle'} />
                                    {item.document?.type}
                                  </div>
                                </Cell>
                              </Row>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>

                {data?.error && (
                  <p className="notice flex-shrink-0 error margin-top-sm">
                    {data.error}
                  </p>
                )}
                <div className="flex flex-shrink-0 flex-1 justify-end gap-2 items-center">
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
