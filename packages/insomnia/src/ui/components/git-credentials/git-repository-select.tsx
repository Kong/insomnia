import React, { useEffect, useRef, useState } from 'react';
import { Button, ComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components';

import { fuzzyMatch } from '~/common/misc';
import { useGitProviderRepositoriesLoaderFetcher } from '~/routes/git-provider.repositories';
import type { GitRemoteProviderType } from '~/sync/git/providers/types';

import { Icon } from '../icon';

export const GitRepositorySelect = ({
  uri,
  onSelect,
  credentialsId,
  allConnectedRepoURIInfoMap,
  providerType,
}: {
  onSelect: (repoUri: string) => void;
  uri?: string;
  credentialsId?: string;
  allConnectedRepoURIInfoMap?: Record<string, { organizationName: string; projectName: string }> | undefined;
  providerType?: GitRemoteProviderType;
}) => {
  const getGitProviderRepositoriesFetcher = useGitProviderRepositoriesLoaderFetcher();
  const lastLoadedCredentialsIdRef = useRef<string | undefined>();

  useEffect(() => {
    const hasData = getGitProviderRepositoriesFetcher.data;
    const credentialsChanged = lastLoadedCredentialsIdRef.current !== credentialsId;
    const shouldLoad = credentialsId && (credentialsChanged || !hasData);

    if (getGitProviderRepositoriesFetcher.state === 'idle' && shouldLoad) {
      lastLoadedCredentialsIdRef.current = credentialsId;
      getGitProviderRepositoriesFetcher.load({ credentialsId });
    }
  }, [credentialsId, getGitProviderRepositoriesFetcher]);

  const loading = getGitProviderRepositoriesFetcher.state !== 'idle';

  const [cannotFindRepository, setCannotFindRepository] = useState(false);

  const repositories = getGitProviderRepositoriesFetcher.data?.repos || [];
  const errors = getGitProviderRepositoriesFetcher.data?.errors || [];

  const selectedRepository = repositories.find(r => r.cloneUrl === uri);

  return (
    <div className="flex flex-col">
      <ComboBox
        aria-label="Repositories"
        name="uri"
        allowsCustomValue={false}
        className="w-full"
        isRequired
        isDisabled={loading}
        onSelectionChange={key => {
          if (!key) {
            onSelect('');
            return;
          }
          const selectedRepository = repositories.find(r => r.cloneUrl === key);
          if (selectedRepository) {
            setCannotFindRepository(false);
            onSelect(selectedRepository.cloneUrl);
          } else {
            setCannotFindRepository(true);
          }
        }}
        defaultItems={repositories.map(repo => ({
          id: repo.cloneUrl,
          name: repo.fullName,
        }))}
        menuTrigger="focus"
        defaultFilter={(repoName: string, inputValue: string) =>
          Boolean(fuzzyMatch(inputValue, repoName, { splitSpace: true, loose: false })?.indexes)
        }
      >
        <Label className="mb-1 pt-0 text-sm">Repository</Label>
        <div className="flex w-full items-start gap-2">
          <div className="group flex h-(--line-height-xs) flex-1 items-start gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
            <Input
              aria-label="Repository Search"
              placeholder={loading ? 'Fetching...' : 'Find a repository...'}
              className="w-full py-1 pr-7 pl-2 placeholder:italic"
            />
            <Button
              id="github_repo_select_dropdown_button"
              type="button"
              className="m-2 flex aspect-square items-center justify-center gap-2 truncate rounded-xs border-none! text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
            >
              <Icon icon="caret-down" className="w-5 shrink-0" />
            </Button>
          </div>

          {/* There ought to be only on react-aria Button under ComboBox, so we use the original button here */}
          <button
            type="button"
            disabled={loading || !credentialsId}
            className="mr-0 flex aspect-square size-(--line-height-xs) items-center justify-center gap-2 truncate rounded-xs border border-solid border-(--hl-sm) p-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset active:bg-(--hl-sm)"
            aria-label="Refresh repositories"
            onClick={() => {
              if (credentialsId) {
                getGitProviderRepositoriesFetcher.load({ credentialsId, refresh: true });
              }
            }}
          >
            <Icon icon="refresh" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {providerType === 'github' && (
          <span className={`flex gap-1 p-2 text-xs ${loading ? 'opacity-40' : ''}`}>
            <Icon icon="info-circle" className="text-(--hl)" />
            <span>Can't find a repository?</span>
            <a
              className="flex items-center gap-1 text-(--color-surprise)"
              href="https://github.com/apps/insomnia-desktop/installations/select_target"
            >
              Configure on GitHub <i className="fa-solid fa-up-right-from-square" />
            </a>
          </span>
        )}
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
            {item => {
              const connectedInfo = allConnectedRepoURIInfoMap?.[item.id];
              const isDisabled = Boolean(connectedInfo);
              return (
                <ListBoxItem
                  isDisabled={isDisabled}
                  textValue={item.name}
                  className="group flex h-(--line-height-xs) w-full items-center gap-2 rounded-sm bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden aria-disabled:cursor-not-allowed aria-selected:bg-(--hl-sm) aria-selected:font-bold data-focused:bg-(--hl-xs)"
                >
                  {isDisabled && <Icon icon="lock" className="group-aria-disabled:opacity-30" />}
                  <span className="truncate group-aria-disabled:opacity-30">{item.name}</span>
                  {connectedInfo && (
                    /* If you use hidden here, if the drop down is a long list and you scroll to the disabled item and hover on it, the scroll bar will scroll to the top. So we use invisible instead */
                    <span className="invisible rounded border border-solid border-(--hl-xl) px-2 py-1 text-(--color-font) group-hover:visible">
                      Already connected to: {connectedInfo.organizationName} / {connectedInfo.projectName}
                    </span>
                  )}
                </ListBoxItem>
              );
            }}
          </ListBox>
        </Popover>
        <FieldError className="text-xs text-(--color-danger)" />
        <input type="hidden" name="uri" value={selectedRepository?.cloneUrl || uri || ''} />
      </ComboBox>
      {errors.length > 0 && (
        <div className="notice error margin-bottom-sm">
          {errors.map(error => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      {cannotFindRepository && (
        <div className="text-sm text-red-500">
          <Icon icon="warning" /> Repository information could not be retrieved. Please <code>Reset</code> and select a
          different repository.
        </div>
      )}
      {selectedRepository && !selectedRepository.permissions.push && (
        <div className="mt-2 text-sm text-orange-500">
          <Icon icon="warning" /> You do not have write access to this repository
        </div>
      )}
    </div>
  );
};
