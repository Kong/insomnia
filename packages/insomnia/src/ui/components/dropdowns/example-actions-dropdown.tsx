import type { ExampleSummary } from 'insomnia-data';
import React, { Fragment } from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';

import { toKebabCase } from '~/common/misc';
import { Icon } from '~/ui/components/icon';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import {
  useCreateRequestFromExample,
  useDeleteExample,
  useDuplicateExample,
  useUpdateExample,
} from '~/ui/hooks/use-example-mutations';

interface Props {
  example: ExampleSummary;
  // The example's own location: the sidebar lists examples from every
  // workspace, so navigation must not read the active route's params.
  organizationId: string;
  projectId: string;
  workspaceId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const ExampleActionsDropdown = ({
  example,
  organizationId,
  projectId,
  workspaceId,
  isOpen,
  onOpenChange,
}: Props) => {
  const updateExample = useUpdateExample();
  const duplicateExampleMutation = useDuplicateExample();
  const deleteExampleMutation = useDeleteExample();
  const createRequestFromExampleMutation = useCreateRequestFromExample();

  const exampleName = example.name || `Example ${example.response.statusCode}`;

  const createRequestFromExample = () => {
    createRequestFromExampleMutation.mutate({
      exampleId: example._id,
      parentId: example.parentId,
      organizationId,
      projectId,
      workspaceId,
    });
  };

  const duplicateExample = () => {
    showModal(PromptModal, {
      title: 'Duplicate Example',
      defaultValue: exampleName,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: (name: string) =>
        duplicateExampleMutation.mutate({ exampleId: example._id, parentId: example.parentId, name }),
    });
  };

  const renameExample = () => {
    showModal(PromptModal, {
      title: `Rename ${exampleName}`,
      defaultValue: exampleName,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: (name: string) =>
        updateExample.mutate({ exampleId: example._id, parentId: example.parentId, patch: { name } }),
    });
  };

  const deleteExample = () => {
    showModal(AskModal, {
      title: 'Delete Example',
      message: `Do you really want to delete "${exampleName}"?`,
      yesText: 'Delete',
      noText: 'Cancel',
      color: 'danger',
      onDone: async (isYes: boolean) => {
        if (isYes) {
          deleteExampleMutation.mutate({ exampleId: example._id, parentId: example.parentId });
        }
      },
    });
  };

  const actionList = [
    {
      name: 'Actions',
      id: 'actions',
      icon: 'cog' as const,
      items: [
        {
          id: 'CreateRequest',
          name: 'Create Request from Example',
          icon: 'plus' as const,
          action: createRequestFromExample,
        },
        { id: 'Duplicate', name: 'Duplicate', icon: 'copy' as const, action: duplicateExample },
        { id: 'Rename', name: 'Rename', icon: 'edit' as const, action: renameExample },
        { id: 'Delete', name: 'Delete', icon: 'trash' as const, action: deleteExample },
      ],
    },
  ];

  return (
    <Fragment>
      <MenuTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
        <Button
          data-testid={`Dropdown-${toKebabCase(exampleName)}`}
          aria-label="Example Actions"
          className="aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:flex group-hover:opacity-100 group-focus:flex group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:flex data-pressed:opacity-100"
        >
          <Icon icon="ellipsis" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden" placement="bottom end">
          <Menu
            aria-label="Example Actions Menu"
            selectionMode="single"
            onAction={key => actionList.find(i => i.items.find(a => a.id === key))?.items.find(a => a.id === key)?.action()}
            items={actionList}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
          >
            {section => (
              <MenuSection className="flex flex-1 flex-col">
                <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
                  {item => (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                      aria-label={item.name}
                    >
                      <Icon icon={item.icon} />
                      <span>{item.name}</span>
                    </MenuItem>
                  )}
                </Collection>
              </MenuSection>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
    </Fragment>
  );
};
