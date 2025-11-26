import { readFile } from 'node:fs/promises';

import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC } from 'react';
import { Button, Heading, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import { documentationLinks } from '../../common/documentation';
import { selectFileOrFolder } from '../../common/select-file-or-folder';
import { blankSpec as emptySpec, petStoreSpec, todoSpec } from './example-openapi-specs';
import { Icon } from './icon';
import { showModal } from './modals';
import { PromptModal } from './modals/prompt-modal';

interface Props {
  onImport: (contents: string) => void;
}

export const DesignEmptyState: FC<Props> = ({ onImport }) => {
  const exampleSpecs = [
    {
      id: 'petstore-spec',
      name: 'Pet Store',
      icon: 'cat',
      action: async () => onImport(petStoreSpec),
    },
    {
      id: 'todo-spec',
      name: 'Todo List',
      icon: 'list-check',
      action: async () => onImport(todoSpec),
    },
    {
      id: 'separator1',
    },
    {
      id: 'empty-spec',
      name: 'Empty',
      icon: 'file',
      action: async () => onImport(emptySpec),
    },
  ] satisfies {
    id: string;
    name?: string;
    icon?: IconName;
    action?: () => void;
  }[];

  const importActionsList = [
    {
      id: 'import-file',
      name: 'Import File',
      icon: 'file-import',
      action: async () => {
        const { canceled, filePath } = await selectFileOrFolder({
          extensions: ['yml', 'yaml', 'json'],
          itemTypes: ['file'],
        });
        // Exit if no file selected
        if (canceled || !filePath) {
          return;
        }

        const contents = String(await readFile(filePath));
        onImport(contents);
      },
    },
    {
      id: 'import-url',
      name: 'Import URL',
      icon: 'link',
      action: async () => {
        showModal(PromptModal, {
          title: 'Import document from URL',
          submitName: 'Fetch and Import',
          label: 'URL',
          placeholder: 'e.g. https://petstore.swagger.io/v2/swagger.json',
          onComplete: async (uri: string) => {
            const response = await window.fetch(uri);
            if (!response) {
              return;
            }
            const contents = await response.text();
            onImport(contents);
          },
        });
      },
    },
  ] satisfies {
    id: string;
    name: string;
    icon: IconName;
    action: () => void;
  }[];

  return (
    <div className="pointer-events-none absolute top-0 left-0 flex h-full w-full items-center select-none">
      <div className="flex h-full w-full flex-1 flex-col items-center gap-2 divide-y divide-solid divide-(--hl-md) overflow-hidden overflow-y-auto p-(--padding-md) text-(--hl-lg)">
        <Heading className="flex flex-1 flex-col items-center gap-2 p-(--padding-sm) font-bold">
          <Icon icon="drafting-compass" className="w-20 flex-1" />
          <span>Enter your OpenAPI specification here</span>
        </Heading>
        <div className="flex w-full flex-1 flex-col items-center justify-between p-(--padding-sm) pt-10">
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-6 truncate">
              <span>Or quick start:</span>
              <div className="flex gap-4">
                <MenuTrigger>
                  <Button
                    aria-label="Start from a sample"
                    className="pointer-events-auto flex aspect-square h-6 items-center justify-center gap-2 rounded-xs bg-(--hl-xs) p-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                  >
                    <Icon icon="file" />
                    <span>Use example</span>
                    <Icon icon="caret-down" />
                  </Button>
                  <Popover className="flex min-w-max flex-col overflow-y-hidden">
                    <Menu
                      aria-label="Start from a sample dropdown"
                      selectionMode="single"
                      onAction={key => {
                        exampleSpecs.find(({ id }) => key === id)?.action?.();
                      }}
                      items={exampleSpecs}
                      className="min-w-max cursor-pointer overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none focus:outline-hidden"
                    >
                      {item =>
                        item.id.startsWith('separator') ? (
                          <MenuItem
                            key={item.id}
                            id={item.id}
                            className="pointer-events-none m-0 my-1 h-px w-full border-0 bg-(--hl-md) p-0"
                          />
                        ) : (
                          <MenuItem
                            key={item.id}
                            id={item.id}
                            className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                            aria-label={item.name}
                          >
                            {item.icon && <Icon icon={item.icon} />}
                            <span>{item.name}</span>
                          </MenuItem>
                        )
                      }
                    </Menu>
                  </Popover>
                </MenuTrigger>
                <Button
                  className="pointer-events-auto flex aspect-square h-6 items-center justify-center gap-2 rounded-xs bg-(--hl-xs) p-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                  onPress={() => {
                    importActionsList.find(({ id }) => id === 'import-file')?.action();
                  }}
                >
                  <Icon icon="file-import" />
                  Import file
                </Button>
                <Button
                  className="pointer-events-auto flex aspect-square h-6 items-center justify-center gap-2 rounded-xs bg-(--hl-xs) p-4 text-sm text-(--color-font) ring-1 ring-transparent transition-all group-hover:opacity-100 group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:opacity-100"
                  onPress={() => {
                    importActionsList.find(({ id }) => id === 'import-url')?.action();
                  }}
                >
                  <Icon icon="link" />
                  Import URL
                </Button>
              </div>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            <li>
              <a
                className="pointer-events-auto flex items-center gap-2 text-sm font-bold transition-colors hover:text-(--hl) focus:text-(--hl)"
                href={documentationLinks.workingWithDesignDocs.url}
              >
                <span className="truncate">{documentationLinks.workingWithDesignDocs.title}</span>
                <Icon icon="external-link" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
