import type { GitCredentials } from 'insomnia-data';
import { type FC, Fragment, useState } from 'react';
import { Button, Label, ListBox, ListBoxItem, Popover, Select, Separator } from 'react-aria-components';

import { Icon } from '~/basic-components/icon';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

interface Props {
  credentials: GitCredentials[];
  providers: GitProviderOption[];
  selectedCredentialsId: string | null | undefined;
  onChange: (credentialsId: string) => void;
  label?: string;
}

/**
 * Picker for the Git credentials associated with a repository. Defaults to the
 * native (system git) credentials, which require no remote configuration. Used
 * by the "Open existing folder" flow.
 */
export const GitCredentialSelect: FC<Props> = ({
  credentials,
  providers,
  selectedCredentialsId,
  onChange,
  label = 'Git credentials',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = credentials.find(c => c._id === selectedCredentialsId);
  const selectedProvider = providers.find(p => p.type === selected?.provider);

  return (
    <Select
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      aria-label={label}
      selectedKey={selected?._id ?? null}
      onSelectionChange={key => onChange(key as string)}
    >
      <Label className="mb-2 px-0.5 pt-0 text-sm text-(--color-font)">{label}</Label>
      <Button className="flex w-full flex-1 items-center justify-between gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-(--color-font) ring-1 ring-transparent transition-colors hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)">
        <span className="flex items-center gap-2 truncate">
          {selected ? (
            <Fragment>
              {selectedProvider?.iconName && <Icon icon={selectedProvider.iconName} className="size-4" />}
              <span>{selectedProvider?.displayName}</span>
              {selected.author?.name && (
                <Fragment>
                  <Separator orientation="vertical" className="mx-2 h-4 border-l border-(--color-font)" />
                  <span className="truncate">{selected.author.name}</span>
                </Fragment>
              )}
            </Fragment>
          ) : (
            'Select credentials'
          )}
        </span>
        <Icon icon="caret-down" />
      </Button>
      <Popover className="isolate flex w-(--trigger-width) min-w-max flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none">
        <ListBox className="min-w-max overflow-y-auto py-2 focus:outline-hidden">
          {credentials.map(item => {
            const provider = providers.find(p => p.type === item.provider);
            return (
              <ListBoxItem
                id={item._id}
                key={item._id}
                aria-label={item.name}
                textValue={item.name}
                className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden aria-selected:font-bold"
              >
                {provider?.iconName && <Icon icon={provider.iconName} className="size-4" />}
                <span>{provider?.displayName}</span>
                {item.author?.name && (
                  <Fragment>
                    <Separator orientation="vertical" className="mx-2 h-4 border-l border-(--color-font)" />
                    <span className="truncate">{item.author.name}</span>
                  </Fragment>
                )}
              </ListBoxItem>
            );
          })}
        </ListBox>
        <div className="w-(--trigger-width) bg-(--hl-xs) p-4 text-sm text-(--color-font)">
          <Button
            onPress={() => {
              setIsOpen(false);
              showSettingsModal({ tab: 'credentials' });
            }}
            className="underline"
          >
            Manage credentials
          </Button>
        </div>
      </Popover>
    </Select>
  );
};
