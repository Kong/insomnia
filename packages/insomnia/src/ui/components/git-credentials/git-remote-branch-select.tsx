import React, { useDeferredValue, useEffect } from 'react';
import { Button, ComboBox, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router';

import type { GitCredentials } from '../../../sync/git/git-vcs';
import { Icon } from '../icon';

export const GitRemoteBranchSelect = ({
  url,
  isDisabled,
  credentials,
}: {
  url: string;
  isDisabled: boolean;
  credentials: GitCredentials;
}) => {
  const uri = useDeferredValue(url);
  const remoteBranchesFetcher = useFetcher<{ branches: string[] }>({ key: `branch-select:${uri}` });
  const { organizationId } = useParams<{ organizationId: string }>();

  const isLoadingRemoteBranches = remoteBranchesFetcher.state !== 'idle';

  useEffect(() => {
    if (uri && remoteBranchesFetcher.state === 'idle' && !remoteBranchesFetcher.data) {
      remoteBranchesFetcher.submit(
        // @ts-expect-error credentials is not defined in the type, but it is used here
        {
          uri,
          credentials,
        },
        {
          method: 'POST',
          encType: 'application/json',
          action: `/organization/${organizationId}/git/remote-branches`,
        },
      );
    }
  }, [organizationId, remoteBranchesFetcher, uri, credentials]);

  const remoteBranches = remoteBranchesFetcher.data?.branches || [];

  const isComboboxDisabled = remoteBranches.length === 0 || isLoadingRemoteBranches || !url || isDisabled;

  return (
    <Label className="flex flex-col">
      <span className="text-sm font-semibold">Branch</span>
      <div className="flex items-center gap-2">
        <ComboBox
          key={`${url}:${remoteBranches[0]}:branch-select`}
          aria-label="Branch to clone"
          allowsCustomValue={false}
          className="w-full"
          defaultSelectedKey={remoteBranches[0]}
          isDisabled={isComboboxDisabled}
          items={remoteBranches.map(branch => ({
            id: branch,
            name: branch,
          }))}
        >
          <div className="group flex items-center gap-2 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]">
            <Input
              name="branch"
              aria-label="Search branches"
              placeholder={isLoadingRemoteBranches ? 'Fetching remote branches...' : 'Default branch'}
              className="w-full py-1 pl-2 pr-7 placeholder:italic"
            />
            <Button
              type="button"
              className="m-2 flex aspect-square items-center justify-center gap-2 truncate rounded-sm !border-none text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
            >
              <Icon icon="caret-down" className="w-5 flex-shrink-0" />
            </Button>
          </div>
          <Popover
            className="grid w-[--trigger-width] min-w-max select-none grid-flow-col divide-x divide-solid divide-[--hl-md] overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-sm shadow-lg focus:outline-none"
            placement="bottom start"
            offset={8}
          >
            <ListBox<{
              id: string;
              name: string;
            }> className="flex min-w-max select-none flex-col p-2 text-sm focus:outline-none">
              {item => (
                <ListBoxItem
                  textValue={item.name}
                  className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap rounded bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:bg-[--hl-sm] aria-selected:font-bold data-[focused]:bg-[--hl-xs]"
                >
                  <span className="truncate">{item.name}</span>
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </ComboBox>
        <Button
          type="button"
          isDisabled={isComboboxDisabled}
          className="m-2 flex aspect-square size-[--line-height-xs] items-center justify-center gap-2 truncate rounded-sm border border-solid border-[--hl-sm] p-2 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:opacity-30 aria-pressed:bg-[--hl-sm]"
          aria-label="Refresh repositories"
          onPress={() => {
            if (uri && remoteBranchesFetcher.state === 'idle') {
              remoteBranchesFetcher.submit(
                // @ts-expect-error credentials is not defined in the type, but it is used here
                {
                  uri,
                  credentials,
                },
                {
                  method: 'POST',
                  encType: 'application/json',
                  action: `/organization/${organizationId}/git/remote-branches`,
                },
              );
            }
          }}
        >
          <Icon icon="refresh" className={isLoadingRemoteBranches ? 'animate-spin' : ''} />
        </Button>
      </div>
    </Label>
  );
};
