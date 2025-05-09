import React, { useEffect, useState } from 'react';
import { Button as ComboButton, ComboBox, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';

// import { useFetcher, useParams } from 'react-router';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { isGitHubAppUserToken } from '../github-app-config-link';
import { Icon } from '../icon';
import { showError } from '../modals';
import { Button } from '../themed-button';

type GitHubRepository = Awaited<ReturnType<typeof window.main.git.getGitHubRepositories>>['repos'][number];

export const GitHubRepositorySelect = ({ uri, token }: { uri?: string; token: string }) => {
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);
  const [cannotFindRepository, setCannotFindRepository] = useState(false);

  const getRepositories = async () => {
    setLoading(true);
    setRepositories([]);
    const { repos, errors } = await window.main.git.getGitHubRepositories({});
    if (errors.length) {
      showError({
        title: 'Error fetching repositories',
        message: errors.join('\n'),
      });
    }
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
      <span className="flex gap-1 text-sm font-semibold">Repository</span>
      {uri && (
        <div className="form-control form-control--outlined">
          <input className="form-control" disabled defaultValue={uri} />
        </div>
      )}
      {!uri && (
        <>
          <div className="flex flex-row items-center gap-2 py-2">
            <ComboBox
              aria-label="Repositories"
              allowsCustomValue={false}
              className="w-full"
              isDisabled={loading}
              defaultItems={repositories.map(repo => ({
                id: repo.clone_url,
                name: repo.full_name,
              }))}
              onSelectionChange={key => setSelectedRepository(repositories.find(r => r.clone_url === key) || null)}
            >
              <div className="group flex items-center gap-2 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] transition-colors focus:outline-none focus:ring-1 focus:ring-[--hl-md]">
                <Input
                  aria-label="Repository Search"
                  placeholder={loading ? 'Fetching...' : 'Find a repository...'}
                  className="w-full py-1 pl-2 pr-7 placeholder:italic"
                />
                <ComboButton
                  id="github_repo_select_dropdown_button"
                  type="button"
                  className="m-2 flex aspect-square items-center justify-center gap-2 truncate rounded-sm !border-none text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                >
                  <Icon icon="caret-down" className="w-5 flex-shrink-0" />
                </ComboButton>
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
              <input type="hidden" name="uri" value={selectedRepository?.clone_url || uri || ''} />
            </ComboBox>
            <Button
              type="button"
              disabled={loading}
              className="m-2 flex aspect-square items-center justify-center gap-2 truncate rounded-sm border border-solid border-[--hl-sm] !p-0 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              aria-label="Refresh repositories"
              onClick={() => {
                setLoading(true);
                getRepositories();
              }}
            >
              <Icon icon="refresh" className={loading ? 'animate-spin' : ''} />
            </Button>
          </div>
          {isGitHubAppUserToken(token) && (
            <div className={`flex gap-1 text-sm ${loading ? 'opacity-40' : ''}`}>
              Can't find a repository?
              <a
                className="flex items-center gap-1 text-purple-500"
                href={`${getAppWebsiteBaseURL()}/oauth/github-app`}
              >
                Configure the App <i className="fa-solid fa-up-right-from-square" />
              </a>
            </div>
          )}
        </>
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
    </div>
  );
};
