import React, { useEffect, useState } from 'react';
import { Button, ComboBox, FieldError, Input, Label, ListBox, ListBoxItem, Popover } from 'react-aria-components';

import { getAppWebsiteBaseURL } from '../../../common/constants';
import { isGitHubAppUserToken } from '../github-app-config-link';
import { Icon } from '../icon';
import { GitRemoteBranchSelect } from './git-remote-branch-select';

type GitHubRepository = Awaited<ReturnType<typeof window.main.git.getGitHubRepositories>>['repos'][number];

export const GitHubRepositorySelect = ({
  uri,
  token,
  allConnectedRepoURIProjectNameMap,
}: {
  uri?: string;
  token: string;
  allConnectedRepoURIProjectNameMap?: Record<string, string> | undefined;
}) => {
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);
  const [cannotFindRepository, setCannotFindRepository] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const getRepositories = async () => {
    setLoading(true);
    setRepositories([]);
    const { repos, errors } = await window.main.git.getGitHubRepositories({});
    setErrors(errors);
    setRepositories(repos);
    setLoading(false);
  };

  useEffect(() => {
    if (!token || uri) {
      return;
    }
    getRepositories();
  }, [token, uri]);

  useEffect(() => {
    if (!uri) {
      setCannotFindRepository(false);
      return;
    }
    if (!selectedRepository && token && isGitHubAppUserToken(token)) {
      (async function getRepository() {
        const { repo, errors, notFound } = await window.main.git.getGitHubRepository({ uri });
        setCannotFindRepository(notFound);
        setSelectedRepository(errors.length ? null : repo!);
      })();
    }
  }, [selectedRepository, token, uri]);

  return (
    <div className="flex flex-col">
      <Label className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-semibold">Repository</span>
          {!uri && isGitHubAppUserToken(token) && (
            <div className={`flex items-center gap-1 text-sm ${loading ? 'opacity-40' : ''}`}>
              <Icon icon="info-circle" className="text-(--hl)" />
              <span>Can't find a repository?</span>
              <a
                className="flex items-center gap-1 text-(--color-surprise)"
                href={`${getAppWebsiteBaseURL()}/oauth/github-app`}
              >
                Configure the App <i className="fa-solid fa-up-right-from-square" />
              </a>
            </div>
          )}
        </div>
        {uri && (
          <div className="form-control form-control--outlined">
            <input className="form-control" disabled defaultValue={uri} />
          </div>
        )}
        {!uri && (
          <ComboBox
            aria-label="Repositories"
            allowsCustomValue={false}
            className="w-full"
            isRequired
            isDisabled={loading}
            defaultItems={repositories.map(repo => ({
              id: repo.clone_url,
              name: repo.full_name,
            }))}
            onSelectionChange={key => setSelectedRepository(repositories.find(r => r.clone_url === key) || null)}
            menuTrigger="focus"
          >
            <div className="flex w-full items-center gap-2">
              <div className="group flex h-(--line-height-xs) flex-1 items-center gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
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
                disabled={loading}
                className="m-2 flex aspect-square size-(--line-height-xs) items-center justify-center gap-2 truncate rounded-xs border border-solid border-(--hl-sm) p-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset active:bg-(--hl-sm)"
                aria-label="Refresh repositories"
                onClick={() => {
                  getRepositories();
                }}
              >
                <Icon icon="refresh" className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <Popover
              className="grid w-(--trigger-width) min-w-max grid-flow-col divide-x divide-solid divide-(--hl-md) overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none focus:outline-hidden"
              placement="bottom start"
              offset={8}
            >
              <ListBox<{
                id: string;
                name: string;
              }> className="flex min-w-max flex-col p-2 text-sm select-none focus:outline-hidden">
                {item => {
                  const isDisabled =
                    allConnectedRepoURIProjectNameMap &&
                    Object.prototype.hasOwnProperty.call(allConnectedRepoURIProjectNameMap, item.id);
                  return (
                    <ListBoxItem
                      isDisabled={isDisabled}
                      textValue={item.name}
                      className="group flex h-(--line-height-xs) w-full items-center gap-2 rounded-sm bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden aria-disabled:cursor-not-allowed aria-selected:bg-(--hl-sm) aria-selected:font-bold data-focused:bg-(--hl-xs)"
                    >
                      {isDisabled && <Icon icon="lock" className="group-aria-disabled:opacity-30" />}
                      <span className="truncate group-aria-disabled:opacity-30">{item.name}</span>
                      {isDisabled && (
                        <span className="hidden rounded border border-solid border-(--hl-xl) px-2 py-1 text-(--color-font) group-hover:inline-block">
                          Already connected to: {allConnectedRepoURIProjectNameMap[item.id]}
                        </span>
                      )}
                    </ListBoxItem>
                  );
                }}
              </ListBox>
            </Popover>
            <FieldError className="text-xs text-(--color-danger)" />
            <input type="hidden" name="uri" value={selectedRepository?.clone_url || uri || ''} />
          </ComboBox>
        )}
      </Label>
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
      {selectedRepository !== null && !selectedRepository.permissions.push && (
        <div className="mt-2 text-sm text-orange-500">
          <Icon icon="warning" /> You do not have write access to this repository
        </div>
      )}
      {!uri && (
        <GitRemoteBranchSelect
          credentials={{
            oauth2format: 'github',
            token: '',
            password: '',
            username: '',
          }}
          isDisabled={loading}
          url={selectedRepository?.clone_url || ''}
        />
      )}
    </div>
  );
};
