import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useRef } from 'react';
import { Button, ComboBox, Dialog, DialogTrigger, Heading, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { fuzzyMatch, isNotNullOrUndefined } from '../../common/misc';
import type { WorkspaceLoaderData } from '../routes/workspace';
import { Icon } from './icon';
const isTrue = true;
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
  const collectionEnvironmentList = [...subEnvironments].map(({ type, ...environment }) => ({ ...environment, id: environment._id, isBase: environment._id === baseEnvironment._id }));

  const selectedGlobalBaseEnvironmentId = activeGlobalEnvironment?.parentId.startsWith('wrk') ? activeGlobalEnvironment._id : activeGlobalEnvironment?.parentId;
  const selectedGlobalBaseEnvironment = globalBaseEnvironments.find(e => e._id === selectedGlobalBaseEnvironmentId);

  const globalEnvironmentList = selectedGlobalBaseEnvironment ? [...globalSubEnvironments.filter(e => e.parentId === selectedGlobalBaseEnvironment._id)].map(({ type, ...subenvironment }) => ({ ...subenvironment, id: subenvironment._id, isBase: subenvironment._id === selectedGlobalBaseEnvironment._id })) : [];

  const activeGlobalBaseEnvironment = selectedGlobalBaseEnvironment;
  const activeGlobalSubEnvironment = globalSubEnvironments.find(e => e._id === activeGlobalEnvironment?._id);
  const activeBaseEnvironment = baseEnvironment;
  const activeSubEnvironment = subEnvironments.find(e => e._id === activeEnvironment._id);

  const selectedEnvironments = [activeGlobalBaseEnvironment, activeGlobalSubEnvironment ? { ...activeGlobalSubEnvironment, workspaceName: activeGlobalBaseEnvironment?.workspaceName } : undefined, activeBaseEnvironment, activeSubEnvironment].filter(isNotNullOrUndefined).map((environment, index) => ({ ...environment, id: environment._id, level: index + 1 }));

  const navigate = useNavigate();

  const globalEnvironmentListBox = useRef<HTMLDivElement>(null);

  if (isTrue) {
    return (
      <div className='flex flex-col'>
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
            if (environmentId === 'all' || environmentId === null) {
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
          selectedKey={selectedGlobalBaseEnvironmentId}
          items={[{ id: '', icon: 'cancel', name: 'No Global Environment', textValue: 'No Global Environment' }, ...globalBaseEnvironments.map(baseEnv => {
            return {
              id: baseEnv._id,
              icon: 'code',
              name: baseEnv.workspaceName || baseEnv.name,
              textValue: baseEnv.workspaceName || baseEnv.name,
            };
          })]}
        >
          <div className='px-2 flex items-center gap-2 group rounded-sm bg-[--color-bg] text-[--color-font] text-sm focus:outline-none focus:ring-1 hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all'>
            {activeGlobalEnvironment && <Icon icon={activeGlobalEnvironment.isPrivate ? 'laptop-code' : 'globe-americas'} style={{ color: activeGlobalEnvironment.color || '' }} className='w-5 flex-shrink-0' />}
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
        {activeGlobalEnvironment && <ComboBox
          aria-label='Global Sub Environment'
          shouldFocusWrap
          key={activeGlobalBaseEnvironment?._id}
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
            if (environmentId === 'all' || environmentId === null) {
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
          inputValue={activeGlobalSubEnvironment?.name}
          selectedKey={activeGlobalSubEnvironment?._id}
          disabledKeys={selectedEnvironments.map(e => e.id)}
          items={globalEnvironmentList}
        >
          <div className='px-2 pl-4 flex items-center gap-2 group rounded-sm bg-[--color-bg] text-[--color-font] text-sm focus:outline-none focus:ring-1 hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all'>
            {activeGlobalEnvironment && <Icon icon={activeGlobalEnvironment.isPrivate ? 'laptop-code' : 'globe-americas'} style={{ color: activeGlobalEnvironment.color || '' }} className='w-5 flex-shrink-0' />}
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
        </ComboBox>}
        <div className='px-2 pl-6 flex items-center gap-2 group rounded-sm bg-[--color-bg] text-[--color-font] text-sm focus:outline-none focus:ring-1 hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all'>
          <Icon icon={'globe-americas'} className='w-5 flex-shrink-0' />
          <div className="py-1 placeholder:italic w-full pl-2 pr-7 ">
            {baseEnvironment.name}
          </div>
        </div>
        <ComboBox
          aria-label='Collection Sub Environment'
          shouldFocusWrap
          key={activeEnvironment._id}
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
            if (environmentId === 'all' || environmentId === null) {
              return;
            }
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
          inputValue={activeEnvironment.name}
          selectedKey={activeEnvironment._id}
          disabledKeys={selectedEnvironments.map(e => e.id)}
          items={collectionEnvironmentList}
        >
          <div className='px-2 pl-8 flex items-center gap-2 group rounded-sm bg-[--color-bg] text-[--color-font] text-sm focus:outline-none focus:ring-1 hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all'>
            {activeEnvironment && <Icon icon={activeEnvironment.isPrivate ? 'laptop-code' : 'globe-americas'} style={{ color: activeEnvironment.color || '' }} className='w-5 flex-shrink-0' />}
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
        {/* <ListBox
          aria-label='Select a Global Environment'
          selectionMode='none'
          ref={globalEnvironmentListBox}
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
        </ListBox> */}
        {/* <ListBox
          aria-label='Select a Collection Environment'
          selectionMode='none'
          key={activeEnvironment._id}
          items={collectionEnvironmentList}
          disabledKeys={selectedEnvironments.map(e => e.id)}
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
          className="p-2 select-none text-sm overflow-y-auto focus:outline-none"
        >
          {item => (
            <ListBoxItem
              className={`aria-disabled:font-bold truncate rounded flex gap-2 pr-1 aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
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
        </ListBox> */}
      </div>
    );
  }

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button aria-label='Manage Environments' className="py-1 px-4 max-w-full items-start gap-2 truncate flex flex-col aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
        {activeGlobalEnvironment && activeGlobalBaseEnvironment && (
          <div className='flex flex-col w-full'>
            <div className='flex items-center gap-2 w-full'>
              <Icon icon={activeGlobalEnvironment.isPrivate ? 'laptop-code' : 'globe-americas'} style={{ color: activeGlobalEnvironment.color || '' }} className='w-5 flex-shrink-0' />
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
          <Icon icon={activeEnvironment.isPrivate ? 'laptop-code' : 'globe-americas'} style={{ color: activeEnvironment.color || '' }} className='w-5 flex-shrink-0' />
          <span className='truncate'>
            {activeSubEnvironment ? activeSubEnvironment.name : activeBaseEnvironment.name}
          </span>
        </div>
      </Button>
      <Popover className="min-w-max max-h-[90vh] flex flex-col !z-10" placement='bottom start' offset={8}>
        <Dialog className="border h-full w-full grid grid-flow-col [grid-auto-columns:min(260px,calc(40vw))_min(260px,calc(40vw))] overflow-hidden divide-x divide-solid divide-[--hl-md] select-none text-sm border-solid border-[--hl-sm] bg-[--color-bg] shadow-lg rounded-md focus:outline-none">
          <div className='relative w-full h-full flex flex-col overflow-hidden flex-1'>
            <div className='relative w-full h-full flex flex-col overflow-hidden flex-1'>
              <Heading className='text-sm flex-shrink-0 h-[--line-height-sm] font-bold text-[--hl] px-3 py-1 flex items-center gap-2 justify-between'>
                <span>Collection Environments ({[baseEnvironment, ...subEnvironments].length})</span>
                <Button onPress={onOpenEnvironmentSettingsModal} aria-label='Manage collection environments' className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] outline-none hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
                  <Icon icon="edit" />
                </Button>
              </Heading>
              <ListBox
                aria-label='Select a Collection Environment'
                selectionMode='none'
                key={activeEnvironment._id}
                items={collectionEnvironmentList}
                disabledKeys={selectedEnvironments.map(e => e.id)}
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
                className="p-2 select-none text-sm overflow-y-auto focus:outline-none"
              >
                {item => (
                  <ListBoxItem
                    className={`aria-disabled:font-bold truncate rounded flex gap-2 pr-1 aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none transition-colors ${item.isBase ? 'pl-[--padding-md]' : 'pl-8'}`}
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
            <div>
              <ComboBox
                aria-label='Global Environment'
                shouldFocusWrap
                key={activeGlobalBaseEnvironment?._id}
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
                  if (environmentId === 'all' || environmentId === null) {
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

                  globalEnvironmentListBox.current?.focus();
                }}
                defaultInputValue={selectedGlobalBaseEnvironment?.workspaceName || selectedGlobalBaseEnvironment?.name || 'No Global Environment'}
                selectedKey={selectedGlobalBaseEnvironmentId}
                defaultItems={[{ id: '', icon: 'cancel', name: 'No Global Environment', textValue: 'No Global Environment' }, ...globalBaseEnvironments.map(baseEnv => {
                  return {
                    id: baseEnv._id,
                    icon: 'code',
                    name: baseEnv.workspaceName || baseEnv.name,
                    textValue: baseEnv.workspaceName || baseEnv.name,
                  };
                })]}
              >
                <div className='px-2 mx-2 my-2 flex items-center gap-2 group rounded-sm bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'>
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
            </div>
            <ListBox
              aria-label='Select a Global Environment'
              selectionMode='none'
              ref={globalEnvironmentListBox}
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
              aria-label='Current selection of environments'
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
              className="select-none w-full empty:p-0 text-sm p-2 flex flex-col overflow-y-auto overflow-x-hidden focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  className={'flex gap-2 pr-1 overflow-hidden aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] rounded focus:bg-[--hl-xs] focus:outline-none transition-colors'}
                  style={{
                    paddingLeft: `${item.level * 8}px`,
                  }}
                >
                  {({ isDisabled }) => (
                    <Fragment>
                      <span
                        className='flex-shrink-0'
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
                      <span title={item.name} className='flex-grow truncate'>
                        {item.name}
                      </span>
                      {'workspaceName' in item && item.workspaceName && <span title={item.workspaceName} className='flex-shrink truncate text-xs text-[--hl]'>
                        {item.workspaceName}
                      </span>}
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
