import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { readFile } from 'fs/promises';
import React, { type FC } from 'react';
import { Button, Heading, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';

import { documentationLinks } from '../../common/documentation';
import { selectFileOrFolder } from '../../common/select-file-or-folder';
import { Icon } from './icon';
import { showPrompt } from './modals';

interface Props {
  onImport: (contents: string) => void;
}

export const DesignEmptyState: FC<Props> = ({ onImport }) => {
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
        showPrompt({
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
    <div className='flex items-center select-none absolute top-0 left-0 w-full h-full pointer-events-none'>
      <div className="h-full w-full flex-1 overflow-y-auto divide-solid divide-y divide-[--hl-md] p-[--padding-md] flex flex-col items-center gap-2 overflow-hidden text-[--hl-lg]">
        <Heading className="text-lg p-[--padding-sm] font-bold flex-1 flex items-center flex-col gap-2">
          <Icon icon="drafting-compass" className="flex-1 w-28" />
          <span>Enter an OpenAPI specification here</span>
        </Heading>
        <div className="flex-1 w-full flex flex-col justify-evenly items-center gap-2 p-[--padding-sm]">
          <p className="flex items-center gap-2">
            <Icon icon="lightbulb" />
            <span className="truncate flex items-center gap-2">
              Or import an existing OpenAPI spec or
              <Button
                className="underline pointer-events-auto font-bold text-[--hl-lg] hover:text-[--hl] focus:text-[--hl] transition-colors"
                onPress={async () => {
                  const spec = await import('./example-openapi-spec');

                  onImport(spec.exampleOpenApiSpec);
                }}
              >
                start from an example
              </Button>
            </span>
          </p>
          <MenuTrigger>
            <Button
              aria-label="Project Actions"
              className="pointer-events-auto items-center bg-[--hl-xs] gap-2 p-4 hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            >
              <span>Import OpenAPI</span>
              <Icon icon="caret-down" />
            </Button>
            <Popover className="min-w-max overflow-y-hidden flex flex-col">
              <Menu
                aria-label='Import OpenAPI Dropdown'
                selectionMode="single"
                onAction={key => {
                  importActionsList.find(({ id }) => key === id)?.action();
                }}
                items={importActionsList}
                className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
              >
                {item => (
                  <MenuItem
                    key={item.id}
                    id={item.id}
                    className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                    aria-label={item.name}
                  >
                    <Icon icon={item.icon} />
                    <span>{item.name}</span>
                  </MenuItem>
                )}
              </Menu>
            </Popover>
          </MenuTrigger>
          <ul className="flex flex-col gap-2">
            <li>
              <a
                className="pointer-events-auto font-bold flex items-center gap-2 text-sm hover:text-[--hl] focus:text-[--hl] transition-colors"
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
