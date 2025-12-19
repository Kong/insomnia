import React, { useDeferredValue } from 'react';
import { Button, ComboBox, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components';
import * as reactUse from 'react-use';
import { z } from 'zod/v4';

import { fuzzyMatch } from '~/common/misc';
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
        defaultItems={remoteBranches.map(branch => ({
          id: branch,
          name: branch,
        }))}
        menuTrigger="focus"
        defaultFilter={(branch: string, inputValue: string) =>
          Boolean(fuzzyMatch(inputValue, branch, { splitSpace: true, loose: false })?.indexes)
        }
      >
        <div className="flex w-full items-center gap-2">
          <div className="group flex h-(--line-height-xs) flex-1 items-center gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
            <Input
              name="branch"
              aria-label="Search branches"
              placeholder={isLoadingRemoteBranches ? 'Fetching remote branches...' : 'Default branch'}
              className="w-full py-1 pr-7 pl-2 placeholder:italic"
            />
            <Button
              type="button"
              className="m-2 flex aspect-square items-center justify-center gap-2 truncate rounded-xs border-none! text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            >
              <Icon icon="caret-down" className="w-5 shrink-0" />
            </Button>
          </div>
          <button
            type="button"
            disabled={isRefetchButtonDisabled}
            className="m-2 mr-0 flex aspect-square size-(--line-height-xs) items-center justify-center gap-2 truncate rounded-xs border border-solid border-(--hl-sm) p-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset active:bg-(--hl-sm) disabled:opacity-30"
            aria-label="Refresh repositories"
            onClick={() => {
              if (uri && !isLoadingRemoteBranches) {
                remoteBranchesFetcher.submit({
                  uri,
                  credentials,
                });
              }
            }}
          >
            <Icon icon="refresh" className={isLoadingRemoteBranches ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="hidden text-xs text-(--color-danger) group-valid/form:inline-flex">{remoteBranchesFetchErrors}</p>
        <Popover
          className="grid w-(--trigger-width) min-w-max grid-flow-col divide-x divide-solid divide-(--hl-md) overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none focus:outline-hidden"
          placement="bottom start"
          offset={8}
          shouldFlip={false}
        >
          <ListBox<{
            id: string;
            name: string;
          }> className="flex min-w-max flex-col p-2 text-sm select-none focus:outline-hidden">
            {item => (
              <ListBoxItem
                textValue={item.name}
                className="flex h-(--line-height-xs) w-full items-center gap-2 rounded-sm bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-selected:bg-(--hl-sm) aria-selected:font-bold data-focused:bg-(--hl-xs)"
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
