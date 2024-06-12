import React, { useState } from 'react';
import { Button, Dialog, Heading, Input, Label, Link, Modal, ModalOverlay, Radio, RadioGroup, TextField } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { invariant } from '../../../utils/invariant';
import { OrganizationLoaderData } from '../../routes/organization';
import { ProjectIdLoaderData } from '../../routes/project';
import { Icon } from '../icon';
import { showModal } from '.';
import { AlertModal } from './alert-modal';

export const MockServerSettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const fetcher = useFetcher();
  const { currentPlan } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const projectData = useRouteLoaderData('/project/:projectId') as ProjectIdLoaderData | null;
  const isLocalProject = !projectData?.activeProject?.remoteId;
  const isEnterprise = currentPlan?.type.includes('enterprise');
  const isSelfHostedDisabled = !isEnterprise;
  const isCloudProjectDisabled = isLocalProject;
  const canOnlyCreateSelfHosted = isLocalProject && isEnterprise;
  const defaultServerType = canOnlyCreateSelfHosted ? 'self-hosted' : 'cloud';
  const [serverType, setServerType] = useState<'self-hosted' | 'cloud'>(defaultServerType);

  return (
    <ModalOverlay
      isOpen
      onOpenChange={() => {
        onClose();
      }}
      isDismissable
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
    >
      <Modal className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]">
        <Dialog className="outline-none">
          {({ close }) => (
            <div className='flex flex-col gap-4'>
              <div className='flex gap-2 items-center justify-between'>
                <Heading className='text-2xl'>Create a mock server</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <form
                className='flex flex-col gap-4'
                onSubmit={e => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const name = formData.get('name') as string;
                  const mockServerType = formData.get('mockServerType') as string;
                  const mockServerUrl = formData.get('mockServerUrl') as string;
                  invariant(mockServerType === 'self-hosted' || mockServerType === 'cloud', 'Project type is required');

                  if (mockServerType === 'self-hosted' && !isEnterprise) {
                    showModal(AlertModal, {
                      title: 'Upgrade required',
                      message: <>Self-hosted Mocks are only supported for Enterprise users. <Link href="https://insomnia.rest/pricing/contact" className="underline">Contact Sales <i className="fa fa-external-link" /></Link></>,
                    });
                    return;
                  }

                  if (mockServerType === 'self-hosted' && !mockServerUrl) {
                    showModal(AlertModal, {
                      title: 'URL required',
                      message: 'Please enter a self-hosted mock server URL.',
                    });
                    return;
                  }
                  if (mockServerType === 'self-hosted') {
                    try {
                      new URL(mockServerUrl);
                    } catch (e) {
                      showModal(AlertModal, {
                        title: 'Invalid URL',
                        message: 'Please enter a valid URL.',
                      });
                      return;
                    }
                  }

                  fetcher.submit(
                    {
                      name,
                      mockServerType,
                      mockServerUrl,
                      scope: 'mock-server',
                    },
                    {
                      action: `/organization/${organizationId}/project/${projectId}/workspace/new`,
                      method: 'post',
                    }
                  );

                  // todo:
                  // reuse this modal for workspace settings, or perhaps remove the change url behaviour?
                }}
              >
                <TextField
                  autoFocus
                  name="name"
                  defaultValue="My mock server"
                  className="group relative flex-1 flex flex-col gap-2"
                >
                  <Label className='text-sm text-[--hl]'>
                    Name
                  </Label>
                  <Input
                    placeholder="My mock server"
                    className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  />
                </TextField>
                <RadioGroup name="mockServerType" defaultValue={serverType} onChange={() => setServerType(serverType === 'self-hosted' ? 'cloud' : 'self-hosted')} className="flex flex-col gap-2">
                  <Label className="text-sm text-[--hl]">
                    Mock server type
                  </Label>
                  <div className="flex gap-2">
                    <Radio
                      value="cloud"
                      isDisabled={isCloudProjectDisabled}
                      className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                    >
                      <div className='flex items-center gap-2'>
                        <Icon icon="globe" />
                        <Heading className="text-lg font-bold">Cloud Mock</Heading>
                      </div>
                      <p className='pt-2'>
                        {isCloudProjectDisabled ? 'Only available for cloud projects' : 'Runs on Insomnia cloud, ideal for collaboration.'}
                      </p>
                    </Radio>
                    <Radio
                      value="self-hosted"
                      isDisabled={isSelfHostedDisabled}
                      className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Icon icon="server" />
                        <Heading className="text-lg font-bold">Self-hosted Mock</Heading>
                      </div>
                      <p className="pt-2">
                        Runs locally or on your infrastructure, ideal for private usage and lower latency.
                      </p>
                    </Radio>
                  </div>
                </RadioGroup>
                <div className="flex items-center gap-2 text-sm">
                  <Icon icon="info-circle" />
                  <span>
                    To learn more about self hosting. <Link href="https://docs.insomnia.rest/insomnia/api-mocking" className='underline'>Click here</Link>
                  </span>
                </div>
                <TextField
                  name="mockServerUrl"
                  className={`group relative flex-1 flex flex-col gap-2 ${serverType === 'cloud' ? 'disabled' : ''}`}
                >
                  <Label className='text-sm text-[--hl]'>
                    Self-hosted mock server URL
                  </Label>
                  <Input
                    disabled={serverType === 'cloud'}
                    placeholder={serverType === 'cloud' ? '' : 'https://example.com'}
                    className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  />
                </TextField>
                <div className="flex justify-end gap-2 items-center">
                  <div className='flex items-center gap-2'>
                    <Button
                      onPress={close}
                      className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="hover:no-underline bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                    >
                      Create
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
