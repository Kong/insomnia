import React, { useDeferredValue } from 'react';
import { Button, ComboBox, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import * as reactUse from 'react-use';
import { z } from 'zod/v4';

import type { GitCredentials } from '~/models/git-repository';
import { useGitRemoteBranchesActionFetcher } from '~/routes/git.remote-branches';

import { Icon } from '../icon';

const GitRemoteURISchema = z.url();

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
  const remoteBranchesFetcher = useGitRemoteBranchesActionFetcher({ key: `branch-select:${uri}` });
  const remoteBranches = remoteBranchesFetcher.data?.branches || [];
  const isLoadingRemoteBranches = remoteBranchesFetcher.state !== 'idle';
  const isComboboxDisabled = remoteBranches.length === 0 || isLoadingRemoteBranches || !uri || isDisabled;
  const areEssentialInputsAvailable = Boolean(
    uri &&
      GitRemoteURISchema.safeParse(uri).success &&
      ('oauth2format' in credentials || (credentials.username && 'password' in credentials && credentials.password)),
  );

  const shouldFetchRemoteBranchesAutomatically =
    areEssentialInputsAvailable && !isLoadingRemoteBranches && !remoteBranchesFetcher.data;

  // Debounce calling submit
  reactUse.useDebounce(
    () => {
      if (shouldFetchRemoteBranchesAutomatically) {
        remoteBranchesFetcher.submit({
          uri,
          credentials,
        });
      }
    },
    300,
    [uri, credentials],
  );

  // The re-fetch button is enabled in case of errors so user can manually recover when possible
  const isRefetchButtonDisabled =
    !remoteBranchesFetcher.data?.errors?.length && (!areEssentialInputsAvailable || isLoadingRemoteBranches);

  const remoteBranchesFetchErrors = remoteBranchesFetcher.data?.errors?.length
    ? remoteBranchesFetcher.data?.errors.join(', ')
    : null;

  return (
    <Label className="flex flex-col">
      <span className="text-sm font-semibold">Branch</span>
      <ComboBox
        isInvalid={!!remoteBranchesFetchErrors}
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
        <div className="flex w-full items-center gap-2">
          <div className="group flex h-(--line-height-xs) flex-1 items-center gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) transition-colors focus:outline-hidden focus:ring-1 focus:ring-(--hl-md)">
            <Input
              name="branch"
              aria-label="Search branches"
              placeholder={isLoadingRemoteBranches ? 'Fetching remote branches...' : 'Default branch'}
              className="w-full py-1 pl-2 pr-7 placeholder:italic"
            />
            <Button
              type="button"
              className="m-2 flex aspect-square items-center justify-center gap-2 truncate rounded-xs border-none! text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
            >
              <Icon icon="caret-down" className="w-5 shrink-0" />
            </Button>
          </div>
          <Button
            type="button"
            isDisabled={isRefetchButtonDisabled}
            className="m-2 flex aspect-square size-(--line-height-xs) items-center justify-center gap-2 truncate rounded-xs border border-solid border-(--hl-sm) p-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) disabled:opacity-30 aria-pressed:bg-(--hl-sm)"
            aria-label="Refresh repositories"
            onPress={() => {
              if (uri && !isLoadingRemoteBranches) {
                remoteBranchesFetcher.submit({
                  uri,
                  credentials,
                });
              }
            }}
          >
            <Icon icon="refresh" className={isLoadingRemoteBranches ? 'animate-spin' : ''} />
          </Button>
        </div>
        <p className="hidden text-xs text-(--color-danger) group-valid/form:inline-flex">{remoteBranchesFetchErrors}</p>
        <Popover
          className="grid w-(--trigger-width) min-w-max select-none grid-flow-col divide-x divide-solid divide-(--hl-md) overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg focus:outline-hidden"
          placement="bottom start"
          offset={8}
        >
          <ListBox<{
            id: string;
            name: string;
          }> className="flex min-w-max select-none flex-col p-2 text-sm focus:outline-hidden">
            {item => (
              <ListBoxItem
                textValue={item.name}
                className="flex h-(--line-height-xs) w-full items-center gap-2 whitespace-nowrap rounded-sm bg-transparent px-(--padding-md) text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:bg-(--hl-sm) aria-selected:font-bold data-focused:bg-(--hl-xs)"
              >
                <span className="truncate">{item.name}</span>
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
    </Label>
  );
};
