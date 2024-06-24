import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment } from 'react';
import { Button, ComboBox, Dialog, DialogTrigger, Heading, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { fuzzyMatch, isNotNullOrUndefined } from '../../common/misc';
import { WorkspaceLoaderData } from '../routes/workspace';
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
    activeEnvironment,
    activeGlobalEnvironment,
    subEnvironments,
    baseEnvironment,
    globalBaseEnvironments,
    globalSubEnvironments,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const setActiveEnvironmentFetcher = useFetcher();
  const setActiveGlobalEnvironmentFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId?: string;
    requestGroupId?: string;
  };
  const collectionEnvironmentList = [baseEnvironment, ...subEnvironments].map(({ type, ...environment }) => ({ ...environment, id: environment._id, isBase: environment._id === baseEnvironment._id }));

  const selectedGlobalBaseEnvironmentId = activeGlobalEnvironment?.parentId.startsWith('wrk') ? activeGlobalEnvironment._id : activeGlobalEnvironment?.parentId;
  const selectedGlobalBaseEnvironment = globalBaseEnvironments.find(e => e._id === selectedGlobalBaseEnvironmentId);

  const globalEnvironmentList = selectedGlobalBaseEnvironment ? [selectedGlobalBaseEnvironment, ...globalSubEnvironments.filter(e => e.parentId === selectedGlobalBaseEnvironment._id)].map(({ type, ...subenvironment }) => ({ ...subenvironment, id: subenvironment._id, isBase: subenvironment._id === selectedGlobalBaseEnvironment._id })) : [];

  const activeGlobalBaseEnvironment = selectedGlobalBaseEnvironment;
  const activeGlobalSubEnvironment = globalSubEnvironments.find(e => e._id === activeGlobalEnvironment?._id);
  const activeBaseEnvironment = baseEnvironment;
  const activeSubEnvironment = subEnvironments.find(e => e._id === activeEnvironment._id);

  const selectedEnvironments = [activeGlobalBaseEnvironment, activeGlobalSubEnvironment, activeBaseEnvironment, activeSubEnvironment].filter(isNotNullOrUndefined).map((environment, index) => ({ ...environment, id: environment._id, level: index + 1 }));

  const navigate = useNavigate();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button className="py-1 px-4 max-w-full gap-2 truncate flex items-center justify-center aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        <Icon icon="code" className='w-5 flex-shrink-0' />
        <span className='truncate'>{activeGlobalEnvironment?._id || activeEnvironment._id ? 'Manage' : 'Add'} Environments</span>
      </Button>
      <Popover className="min-w-max max-h-[90vh] flex flex-col !z-10" placement='bottom start' offset={8}>
        <Dialog className="border h-full w-full grid grid-flow-col  auto-cols-[min(250px,calc(45vw))] overflow-hidden divide-x divide-solid divide-[--hl-md] select-none text-sm border-solid border-[--hl-sm] bg-[--color-bg] shadow-lg rounded-md focus:outline-none">
          <div className='relative w-full h-full flex flex-col overflow-hidden flex-1'>
            <div className='relative w-full h-full flex flex-col overflow-hidden flex-1'>
              <Heading className='text-sm flex-shrink-0 h-[--line-height-sm] font-bold text-[--hl] px-3 py-1 flex items-center gap-2 justify-between'>
                <span>Collection Environments</span>
                <Button onPress={onOpenEnvironmentSettingsModal} aria-label='Manage collection environments' className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <Icon icon="gear" />
                </Button>
              </Heading>
              <ListBox
                aria-label='Select a Collection Environment'
                selectionMode='none'
                key={activeEnvironment._id}
                items={collectionEnvironmentList}
                disabledKeys={selectedEnvironments.map(e => e.id)}
                // disallowEmptySelection
                // onSelectionChange={selection => {
                //   if (selection === 'all') {
                //     return;
                //   }

                //   const environmentId = selection.values().next().value;

                //   setActiveEnvironmentFetcher.submit(
                //     {
                //       environmentId,
                //     },
                //     {
                //       method: 'POST',
                //       action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                //     }
                //   );
                // }}
                // selectedKeys={[activeEnvironment._id || '']}
                onAction={environmentId => {
                  setActiveEnvironmentFetcher.submit(
                    {
                      environmentId,
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                    }
                  );
                }}
                className="p-2 select-none text-sm min-w-max overflow-y-auto focus:outline-none"
              >
                {item => (
                  <ListBoxItem
                    className={`aria-disabled:font-bold rounded flex gap-2 pr-1 aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
                  >
                    {({ isSelected, isDisabled }) => (
                      <Fragment>
                        <span
                          style={{
                            borderColor: item.color ?? 'var(--color-font)',
                          }}
                        >
                          <Icon
                            icon={item.isPrivate ? 'laptop-code' : 'globe-americas'}
                            className='text-xs w-5'
                            style={{
                              color: item.color ?? 'var(--color-font)',
                            }}
                          />
                        </span>
                        <span className='flex-1 truncate'>
                          {item.name}
                        </span>
                        {!isDisabled && <div className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                          <Icon icon="plus-circle" />
                        </div>}
                        {isSelected && (
                          <Icon
                            icon="check"
                            className="text-[--color-success] justify-self-end"
                          />
                        )}
                      </Fragment>
                    )}
                  </ListBoxItem>
                )}
              </ListBox>
            </div>
            <Heading className='text-sm flex-shrink-0 h-[--line-height-sm] font-bold text-[--hl] px-3 py-1 flex items-center gap-2 justify-between'>
              <span>Global Environments ({globalBaseEnvironments.length})</span>
              {selectedGlobalBaseEnvironment && (
                <Button onPress={() => navigate(`/organization/${organizationId}/project/${projectId}/workspace/${selectedGlobalBaseEnvironment.parentId}/environment`)} aria-label='Manage global environment' className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <Icon icon="gear" />
                </Button>
              )}
            </Heading>
            <ComboBox
              aria-label='Global Environment'
              shouldFocusWrap
              allowsCustomValue={false}
              menuTrigger='focus'
              defaultFilter={(textValue, filter) => {
                const match = Boolean(fuzzyMatch(
                  filter,
                  textValue,
                  { splitSpace: false, loose: true }
                )?.indexes);

                return match;
              }}
              onSelectionChange={environmentId => {
                if (environmentId === 'all' || !environmentId) {
                  return;
                }

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
              inputValue={selectedGlobalBaseEnvironment?.workspaceName || selectedGlobalBaseEnvironment?.name || ''}
              selectedKey={selectedGlobalBaseEnvironmentId}
              defaultItems={[...globalBaseEnvironments.map(baseEnv => {
                return {
                  id: baseEnv._id,
                  icon: 'code',
                  name: baseEnv.workspaceName || baseEnv.name,
                  textValue: baseEnv.workspaceName || baseEnv.name,
                };
              }), { id: '', icon: 'cancel', name: 'No Global Environment', textValue: 'No Global Environment' }]}
            >
              <div className='px-2 mx-2 my-2 flex items-center gap-2 group rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'>
                <Input aria-label='Global Environment' placeholder='Choose a global environment' className="py-1 placeholder:italic w-full pl-2 pr-7 " />
                <Button className="aspect-square gap-2 truncate flex items-center justify-center aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <Icon icon="caret-down" className='w-5 flex-shrink-0' />
                </Button>
              </div>
              <Popover className="min-w-max max-h-[90vh] !z-10 border grid grid-flow-col auto-cols-[min(250px,calc(45vw))] overflow-hidden divide-x divide-solid divide-[--hl-md] select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] rounded-md focus:outline-none" placement='bottom start' offset={8}>
                <ListBox<{ name: string; icon: IconName }>
                  className="select-none text-sm min-w-max p-2 flex flex-col overflow-y-auto focus:outline-none"
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
            <ListBox
              aria-label='Select a Global Environment'
              selectionMode='none'
              disallowEmptySelection
              key={activeGlobalEnvironment?._id}
              items={globalEnvironmentList}
              disabledKeys={selectedEnvironments.map(e => e.id)}
              onAction={environmentId => {
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
                  className={`aria-disabled:font-bold rounded flex gap-2 pr-1 aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
                >
                  {({ isDisabled }) => (
                    <Fragment>
                      <span
                        style={{
                          borderColor: item.color ?? 'var(--color-font)',
                        }}
                      >
                        <Icon
                          icon={item.isPrivate ? 'laptop-code' : 'globe-americas'}
                          className='text-xs w-5'
                          style={{
                            color: item.color ?? 'var(--color-font)',
                          }}
                        />
                      </span>
                      <span className='flex-1 truncate'>
                        {item.name}
                      </span>
                      {!isDisabled && <div className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                        <Icon icon="plus-circle" />
                      </div>}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </div>
          <div className='w-full bg-[--hl-xs] h-full flex flex-col overflow-hidden flex-1 relative before:absolute before:h-full before:w-[1px] before:trans'>
            <Heading className='text-sm flex-shrink-0 h-[--line-height-sm] font-bold text-[--hl] px-3 py-1 flex items-center gap-2 justify-between'>
              <span>Current selections ({selectedEnvironments.length})</span>
            </Heading>
            <ListBox
              aria-label='Select a Global Environment'
              selectionMode='none'
              disallowEmptySelection
              key={activeGlobalEnvironment?._id}
              items={selectedEnvironments}
              disabledKeys={[activeBaseEnvironment._id]}
              onAction={environmentId => {
                if (environmentId === activeBaseEnvironment._id) {
                  return;
                }

                if (subEnvironments.some(e => e._id === environmentId)) {
                  setActiveEnvironmentFetcher.submit(
                    {
                      environmentId: baseEnvironment._id,
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                    }
                  );

                  return;
                }

                if (activeGlobalBaseEnvironment && globalSubEnvironments.some(e => e._id === environmentId)) {
                  setActiveGlobalEnvironmentFetcher.submit(
                    {
                      environmentId: activeGlobalBaseEnvironment._id,
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active-global`,
                    }
                  );

                  return;
                }

                if (environmentId === activeGlobalBaseEnvironment?._id) {
                  setActiveGlobalEnvironmentFetcher.submit(
                    {
                      environmentId: '',
                    },
                    {
                      method: 'POST',
                      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active-global`,
                    }
                  );
                }

              }}
              className="select-none empty:p-0 text-sm min-w-max p-2 flex flex-col overflow-y-auto focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  className={'flex gap-2 pr-1 aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] rounded focus:bg-[--hl-xs] focus:outline-none transition-colors'}
                  style={{
                    paddingLeft: `${item.level * 8}px`,
                  }}
                >
                  {({ isDisabled }) => (
                    <Fragment>
                      <span
                        style={{
                          borderColor: item.color ?? 'var(--color-font)',
                        }}
                      >
                        <Icon
                          icon={item.isPrivate ? 'laptop-code' : 'globe-americas'}
                          className='text-xs w-5'
                          style={{
                            color: item.color ?? 'var(--color-font)',
                          }}
                        />
                      </span>
                      <span className='flex-1 truncate'>
                        {item.name}
                      </span>
                      {!isDisabled && <div className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                        <Icon icon="minus-circle" />
                      </div>}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </div>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};
