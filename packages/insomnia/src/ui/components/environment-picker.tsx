import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment } from 'react';
import {
  Button,
  ComboBox,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router';

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

  const collectionEnvironmentList = [baseEnvironment, ...subEnvironments].map(({ type, ...environment }) => ({
    ...environment,
    id: environment._id,
    isBase: environment._id === baseEnvironment._id,
  }));

  const selectedGlobalBaseEnvironmentId = activeGlobalEnvironment?.parentId.startsWith('wrk')
    ? activeGlobalEnvironment._id
    : activeGlobalEnvironment?.parentId;
  const selectedGlobalBaseEnvironment = globalBaseEnvironments.find(e => e._id === selectedGlobalBaseEnvironmentId);

  const globalEnvironmentList = selectedGlobalBaseEnvironment
    ? [
        selectedGlobalBaseEnvironment,
        ...globalSubEnvironments.filter(e => e.parentId === selectedGlobalBaseEnvironment._id),
      ].map(({ type, ...subenvironment }) => ({
        ...subenvironment,
        id: subenvironment._id,
        isBase: subenvironment._id === selectedGlobalBaseEnvironment._id,
      }))
    : [];

  const activeGlobalBaseEnvironment = selectedGlobalBaseEnvironment;
  const activeBaseEnvironment = baseEnvironment;
  const activeSubEnvironment = subEnvironments.find(e => e._id === activeEnvironment._id);

  const navigate = useNavigate();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button
        aria-label="Manage Environments"
        className="flex max-w-full flex-col items-start gap-2 truncate rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
      >
        {activeGlobalEnvironment && activeGlobalBaseEnvironment && (
          <div className="flex w-full flex-col">
            <div className="flex w-full items-center gap-2">
              <Icon
                icon={
                  activeGlobalEnvironment.isPrivate
                    ? 'lock'
                    : isUsingGitSync
                      ? ['fab', 'git-alt']
                      : isUsingInsomniaCloudSync
                        ? 'globe-americas'
                        : 'file-arrow-down'
                }
                style={{ color: activeGlobalEnvironment.color || '' }}
                className="w-5 flex-shrink-0"
              />
              <span className="truncate">{activeGlobalEnvironment.name}</span>
            </div>
            <div className="flex w-full items-center gap-2">
              <Icon icon="0" className="invisible w-5 flex-shrink-0" />
              <span className="flex-shrink truncate text-xs text-[--hl]">
                {activeGlobalBaseEnvironment.workspaceName}
              </span>
            </div>
          </div>
        )}
        <div className="flex w-full flex-1 items-center gap-2">
          <Icon
            icon={
              activeEnvironment.isPrivate
                ? 'lock'
                : isUsingGitSync
                  ? ['fab', 'git-alt']
                  : isUsingInsomniaCloudSync
                    ? 'globe-americas'
                    : 'file-arrow-down'
            }
            style={{ color: activeEnvironment.color || '' }}
            className="w-5 flex-shrink-0"
          />
          <span className="truncate">
            {activeSubEnvironment ? activeSubEnvironment.name : activeBaseEnvironment.name}
          </span>
        </div>
      </Button>
      <Popover className="!z-10 flex max-h-[90vh] min-w-max flex-col" placement="bottom start" offset={8}>
        <Dialog className="grid h-full w-full select-none grid-flow-col divide-x divide-solid divide-[--hl-md] overflow-hidden rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-sm shadow-lg [grid-auto-columns:min(260px,calc(40vw))_min(260px,calc(40vw))] focus:outline-none">
          <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden">
            <Heading className="flex h-[--line-height-sm] flex-shrink-0 items-center justify-between gap-2 px-3 py-1 text-sm font-bold text-[--hl]">
              <span>Global Environments</span>
              <Button
                aria-label="Manage global environment"
                onPress={() =>
                  selectedGlobalBaseEnvironment &&
                  navigate(
                    `/organization/${organizationId}/project/${projectId}/workspace/${selectedGlobalBaseEnvironment.parentId}/environment`,
                  )
                }
                className={`flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] outline-none ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm] ${!selectedGlobalBaseEnvironment ? 'opacity-50' : ''}`}
              >
                <Icon icon="gear" />
              </Button>
            </Heading>
            <div>
              <ComboBox
                aria-label="Global Environment"
                shouldFocusWrap
                allowsCustomValue={false}
                onFocus={() => {}}
                menuTrigger="focus"
                defaultFilter={(textValue, filter) => {
                  const match = Boolean(fuzzyMatch(filter, textValue, { splitSpace: false, loose: true })?.indexes);

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
                    },
                  );
                }}
                defaultInputValue={
                  selectedGlobalBaseEnvironment?.workspaceName ||
                  selectedGlobalBaseEnvironment?.name ||
                  'No Global Environment'
                }
                selectedKey={selectedGlobalBaseEnvironmentId || ''}
                defaultItems={[
                  { id: '', icon: 'cancel', name: 'No Global Environment', textValue: 'No Global Environment' },
                  ...globalBaseEnvironments.map(baseEnv => {
                    return {
                      id: baseEnv._id,
                      icon: 'code',
                      name: baseEnv.workspaceName || baseEnv.name,
                      textValue: baseEnv.workspaceName || baseEnv.name,
                    };
                  }),
                ]}
              >
                <div className="group mx-2 my-2 flex items-center gap-2 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] px-2 text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]">
                  <Input
                    aria-label="Global Environment"
                    placeholder="Choose a global environment"
                    className="w-full py-1 pl-2 pr-7 placeholder:italic"
                  />
                  <Button className="flex aspect-square items-center justify-center gap-2 truncate rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]">
                    <Icon icon="caret-down" className="w-5 flex-shrink-0" />
                  </Button>
                </div>
                <Popover
                  className="!z-10 grid max-h-[90vh] min-w-max select-none auto-cols-[min(250px,calc(45vw))] grid-flow-col divide-x divide-solid divide-[--hl-md] overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-sm shadow-lg focus:outline-none"
                  placement="bottom start"
                  offset={8}
                >
                  <ListBox<{
                    name: string;
                    icon: IconName;
                  }> className="flex h-full max-h-full min-w-max select-none flex-col p-2 text-sm focus:outline-none">
                    {item => (
                      <ListBoxItem
                        textValue={item.name}
                        className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap rounded bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:bg-[--hl-sm] aria-selected:font-bold data-[focused]:bg-[--hl-xs]"
                      >
                        <Icon icon={item.icon} className="w-4" />
                        <span className="truncate">{item.name}</span>
                      </ListBoxItem>
                    )}
                  </ListBox>
                </Popover>
              </ComboBox>
            </div>
            <ListBox
              aria-label="Select a Global Environment"
              selectionMode="single"
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
                  },
                );
              }}
              className="flex min-w-max select-none flex-col overflow-y-auto p-2 text-sm empty:p-0 focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  textValue={item.name}
                  className={`text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap rounded bg-transparent pr-1 text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      <span
                        style={{
                          borderColor: item.color ?? 'var(--color-font)',
                        }}
                      >
                        <Icon
                          icon={
                            item.isPrivate
                              ? 'lock'
                              : isUsingGitSync
                                ? ['fab', 'git-alt']
                                : isUsingInsomniaCloudSync
                                  ? 'globe-americas'
                                  : 'file-arrow-down'
                          }
                          className="w-5 text-xs"
                          style={{
                            color: item.color ?? 'var(--color-font)',
                          }}
                        />
                      </span>
                      <Text slot="label" className="flex-1 truncate">
                        {item.name}
                      </Text>
                      {isSelected && <Icon icon="check" className="justify-self-end px-2 text-[--color-success]" />}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
            <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden">
              <Heading className="flex h-7 flex-shrink-0 items-center justify-between gap-2 px-3 py-1 text-sm font-bold text-[--hl]">
                <span>Collection Environments</span>
                <Button
                  onPress={onOpenEnvironmentSettingsModal}
                  aria-label="Manage collection environments"
                  className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] outline-none ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                >
                  <Icon icon="edit" />
                </Button>
              </Heading>
              <ListBox
                aria-label="Select a Collection Environment"
                selectionMode="single"
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
                    },
                  );
                  uiEventBus.emit('CHANGE_ACTIVE_ENV', workspaceId);
                }}
                className="select-none overflow-y-auto p-2 text-sm focus:outline-none"
              >
                {item => (
                  <ListBoxItem
                    textValue={item.name}
                    className={`text-md flex h-[--line-height-xs] w-full items-center gap-2 truncate whitespace-nowrap rounded bg-transparent pr-1 text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
                  >
                    {({ isSelected }) => (
                      <Fragment>
                        <span
                          style={{
                            borderColor: item.color ?? 'var(--color-font)',
                          }}
                        >
                          <Icon
                            icon={
                              item.isPrivate
                                ? 'lock'
                                : isUsingGitSync
                                  ? ['fab', 'git-alt']
                                  : isUsingInsomniaCloudSync
                                    ? 'globe-americas'
                                    : 'file-arrow-down'
                            }
                            className="w-5 text-xs"
                            style={{
                              color: item.color ?? 'var(--color-font)',
                            }}
                          />
                        </span>
                        <Text slot="label" className="flex-1 truncate">
                          {item.name}
                        </Text>
                        {isSelected && <Icon icon="check" className="justify-self-end px-2 text-[--color-success]" />}
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
