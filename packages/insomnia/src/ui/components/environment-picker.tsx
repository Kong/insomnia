import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment } from 'react';
import { Button, ComboBox, Dialog, DialogTrigger, Heading, Input, ListBox, ListBoxItem, Popover, Text } from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { fuzzyMatch } from '../../common/misc';
import { isRemoteProject } from '../../models/project';
import uiEventBus from '../eventBus';
import { useOrganizationPermissions } from '../hooks/use-organization-features';
import type { WorkspaceLoaderData } from '../routes/workspace';
import { Icon } from './icon';

export const EnvironmentPicker = ({
  isOpen,
  onOpenChange,
  onOpenEnvironmentSettingsModal,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpenEnvironmentSettingsModal: () => void;
}) => {
  const {
    activeProject,
    activeWorkspaceMeta,
    activeEnvironment,
    activeGlobalEnvironment,
    subEnvironments,
    baseEnvironment,
    globalBaseEnvironments,
    globalSubEnvironments,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId?: string;
    requestGroupId?: string;
  };

  const { features } = useOrganizationPermissions();
  const isUsingInsomniaCloudSync = Boolean(isRemoteProject(activeProject) && !activeWorkspaceMeta?.gitRepositoryId);
  const isUsingGitSync = Boolean(features.gitSync.enabled && activeWorkspaceMeta?.gitRepositoryId);

  const setActiveEnvironmentFetcher = useFetcher();
  const setActiveGlobalEnvironmentFetcher = useFetcher();

  const collectionEnvironmentList = [baseEnvironment, ...subEnvironments].map(({ type, ...environment }) => ({ ...environment, id: environment._id, isBase: environment._id === baseEnvironment._id }));

  const selectedGlobalBaseEnvironmentId = activeGlobalEnvironment?.parentId.startsWith('wrk') ? activeGlobalEnvironment._id : activeGlobalEnvironment?.parentId;
  const selectedGlobalBaseEnvironment = globalBaseEnvironments.find(e => e._id === selectedGlobalBaseEnvironmentId);

  const globalEnvironmentList = selectedGlobalBaseEnvironment ? [selectedGlobalBaseEnvironment, ...globalSubEnvironments.filter(e => e.parentId === selectedGlobalBaseEnvironment._id)].map(({ type, ...subenvironment }) => ({ ...subenvironment, id: subenvironment._id, isBase: subenvironment._id === selectedGlobalBaseEnvironment._id })) : [];

  const activeGlobalBaseEnvironment = selectedGlobalBaseEnvironment;
  const activeBaseEnvironment = baseEnvironment;
  const activeSubEnvironment = subEnvironments.find(e => e._id === activeEnvironment._id);

  const navigate = useNavigate();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button aria-label='Manage Environments' className="py-1 px-4 max-w-full items-start gap-2 truncate flex flex-col aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        {activeGlobalEnvironment && activeGlobalBaseEnvironment && (
          <div className='flex flex-col w-full'>
            <div className='flex items-center gap-2 w-full'>
              <Icon icon={activeGlobalEnvironment.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'} style={{ color: activeGlobalEnvironment.color || '' }} className='w-5 flex-shrink-0' />
              <span className='truncate'>
                {activeGlobalEnvironment.name}
              </span>
            </div>
            <div className='flex items-center gap-2 w-full'>
              <Icon icon="0" className='w-5 flex-shrink-0 invisible' />
              <span className='flex-shrink truncate text-xs text-[--hl]'>
                {activeGlobalBaseEnvironment.workspaceName}
              </span>
            </div>
          </div>
        )}
        <div className='flex flex-1 items-center gap-2 w-full'>
          <Icon icon={activeEnvironment.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'} style={{ color: activeEnvironment.color || '' }} className='w-5 flex-shrink-0' />
          <span className='truncate'>
            {activeSubEnvironment ? activeSubEnvironment.name : activeBaseEnvironment.name}
          </span>
        </div>
      </Button>
      <Popover className="min-w-max max-h-[90vh] flex flex-col !z-10" placement='bottom start' offset={8}>
        <Dialog className="border h-full w-full grid grid-flow-col [grid-auto-columns:min(260px,calc(40vw))_min(260px,calc(40vw))] overflow-hidden divide-x divide-solid divide-[--hl-md] select-none text-sm border-solid border-[--hl-sm] bg-[--color-bg] shadow-lg rounded-md focus:outline-none">
          <div className='relative w-full h-full flex flex-col overflow-hidden flex-1'>
            <Heading className='text-sm flex-shrink-0 h-[--line-height-sm] font-bold text-[--hl] px-3 py-1 flex items-center gap-2 justify-between'>
              <span>Global Environments</span>
              <Button
                aria-label='Manage global environment'
                onPress={() => selectedGlobalBaseEnvironment && navigate(`/organization/${organizationId}/project/${projectId}/workspace/${selectedGlobalBaseEnvironment.parentId}/environment`)}
                className={`flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm ${!selectedGlobalBaseEnvironment ? 'opacity-50' : ''}`}
              >
                <Icon icon="gear" />
              </Button>
            </Heading>
            <div>
              <ComboBox
                aria-label='Global Environment'
                shouldFocusWrap
                allowsCustomValue={false}
                onFocus={() => { }}
                menuTrigger='focus'
                defaultFilter={(textValue, filter) => {
                  const match = Boolean(fuzzyMatch(
                    filter,
                    textValue,
                    { splitSpace: false, loose: true }
                  )?.indexes);

                  return match;
                }}
                onSelectionChange={key => {
                  if (key === 'all' || key === null) {
                    return;
                  }

                  setActiveGlobalEnvironmentFetcher.submit(
                    {
                      environmentId: key.toString(),
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active-global`,
                    }
                  );
                }}
                defaultInputValue={selectedGlobalBaseEnvironment?.workspaceName || selectedGlobalBaseEnvironment?.name || 'No Global Environment'}
                selectedKey={selectedGlobalBaseEnvironmentId || ''}
                defaultItems={[{ id: '', icon: 'cancel', name: 'No Global Environment', textValue: 'No Global Environment' }, ...globalBaseEnvironments.map(baseEnv => {
                  return {
                    id: baseEnv._id,
                    icon: 'code',
                    name: baseEnv.workspaceName || baseEnv.name,
                    textValue: baseEnv.workspaceName || baseEnv.name,
                  };
                })]}
              >
                <div className='px-2 mx-2 my-2 flex items-center gap-2 group rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'>
                  <Input aria-label='Global Environment' placeholder='Choose a global environment' className="py-1 placeholder:italic w-full pl-2 pr-7 " />
                  <Button className="aspect-square gap-2 truncate flex items-center justify-center aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                    <Icon icon="caret-down" className='w-5 flex-shrink-0' />
                  </Button>
                </div>
                <Popover className="min-w-max max-h-[90vh] !z-10 border grid grid-flow-col auto-cols-[min(250px,calc(45vw))] overflow-y-auto divide-x divide-solid divide-[--hl-md] select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] rounded-md focus:outline-none" placement='bottom start' offset={8}>
                  <ListBox<{ name: string; icon: IconName }>
                    className="select-none text-sm min-w-max p-2 h-full max-h-full flex flex-col focus:outline-none"
                  >
                    {item => (
                      <ListBoxItem
                        textValue={item.name}
                        className="aria-disabled:opacity-30 aria-selected:bg-[--hl-sm] rounded aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] data-[focused]:bg-[--hl-xs] focus:outline-none transition-colors"
                      >
                        <Icon icon={item.icon} className='w-4' />
                        <span className='truncate'>{item.name}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                </Popover>
              </ComboBox>
            </div>
            <ListBox
              aria-label='Select a Global Environment'
              selectionMode='single'
              disallowEmptySelection
              key={activeGlobalEnvironment?._id}
              items={globalEnvironmentList}
              selectedKeys={[activeGlobalEnvironment?._id || activeGlobalBaseEnvironment?._id || '']}
              onSelectionChange={keys => {
                if (keys === 'all' || !keys) {
                  return;
                }
                const [environmentId] = keys.values();

                setActiveGlobalEnvironmentFetcher.submit(
                  {
                    environmentId,
                  },
                  {
                    method: 'POST',
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active-global`,
                  }
                );
              }}
              className="select-none empty:p-0 text-sm min-w-max p-2 flex flex-col overflow-y-auto focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  textValue={item.name}
                  className={`rounded flex gap-2 pr-1 items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      <span
                        style={{
                          borderColor: item.color ?? 'var(--color-font)',
                        }}
                      >
                        <Icon
                          icon={item.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'}
                          className='text-xs w-5'
                          style={{
                            color: item.color ?? 'var(--color-font)',
                          }}
                        />
                      </span>
                      <Text slot="label" className='flex-1 truncate'>
                        {item.name}
                      </Text>
                      {isSelected && (
                        <Icon
                          icon="check"
                          className="text-[--color-success] justify-self-end px-2"
                        />
                      )}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
            <div className='relative w-full h-full flex flex-col overflow-hidden flex-1'>
              <Heading className='text-sm flex-shrink-0 h-7 font-bold text-[--hl] px-3 py-1 flex items-center gap-2 justify-between'>
                <span>Collection Environments</span>
                <Button onPress={onOpenEnvironmentSettingsModal} aria-label='Manage collection environments' className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <Icon icon="edit" />
                </Button>
              </Heading>
              <ListBox
                aria-label='Select a Collection Environment'
                selectionMode='single'
                key={activeEnvironment._id}
                items={collectionEnvironmentList}
                selectedKeys={[activeEnvironment._id || baseEnvironment._id || '']}
                disallowEmptySelection
                onSelectionChange={keys => {
                  if (keys === 'all' || !keys) {
                    return;
                  }
                  const [environmentId] = keys.values();
                  setActiveEnvironmentFetcher.submit(
                    {
                      environmentId,
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                    }
                  );
                  uiEventBus.emit('CHANGE_ACTIVE_ENV', workspaceId);
                }}
                className="p-2 select-none text-sm overflow-y-auto focus:outline-none"
              >
                {item => (
                  <ListBoxItem
                    textValue={item.name}
                    className={`truncate rounded flex gap-2 pr-1 items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
                  >
                    {({ isSelected }) => (
                      <Fragment>
                        <span
                          style={{
                            borderColor: item.color ?? 'var(--color-font)',
                          }}
                        >
                          <Icon
                            icon={item.isPrivate ? 'lock' : isUsingGitSync ? ['fab', 'git-alt'] : isUsingInsomniaCloudSync ? 'globe-americas' : 'file-arrow-down'}
                            className='text-xs w-5'
                            style={{
                              color: item.color ?? 'var(--color-font)',
                            }}
                          />
                        </span>
                        <Text slot="label" className='flex-1 truncate'>
                          {item.name}
                        </Text>
                        {isSelected && (
                          <Icon
                            icon="check"
                            className="text-[--color-success] justify-self-end px-2"
                          />
                        )}
                      </Fragment>
                    )}
                  </ListBoxItem>
                )}
              </ListBox>
            </div>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
