import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button as ComboButton, ComboBox, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';

// import { useFetcher, useParams } from 'react-router-dom';
import { getAppWebsiteBaseURL, getGitHubRestApiUrl } from '../../../../common/constants';
import { isGitHubAppUserToken } from '../../github-app-config-link';
import { Icon } from '../../icon';
import { Button } from '../../themed-button';
import { showError } from '..';

// fragment of what we receive from the GitHub API
interface GitHubRepository {
  id: string;
  full_name: string;
  clone_url: string;
  permissions: {
    push: boolean;
    pull: boolean;
  };
}

const GITHUB_USER_REPOS_URL = `${getGitHubRestApiUrl()}/user/repos`;

export const GitHubRepositorySelect = (
  { uri, token }: {
    uri?: string;
    token: string;
  }) => {
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);
  const [cannotFindRepository, setCannotFindRepository] = useState(false);
  const fetchOpts = useMemo(() => ({
    headers: {
      Authorization: `token ${token}`,
    },
  }), [token]);

  // this method assumes that GitHub will not change how it paginates this endpoint
  const fetchRepositories = useCallback(async (url: string = `${GITHUB_USER_REPOS_URL}?per_page=100`) => {
    try {
      const response = await fetch(url, fetchOpts);

      if (!response.ok) {
        const raw = await response.text();
        if (response.status === 401) {
          throw new Error(`User token not authorized to fetch repositories, please sign out and back in.\nResponse: ${raw}`);
        }
        throw new Error(`Failed to fetch repositories: ${response.statusText}\nResponse: ${raw}`);
      }

      const data = await response.json();
      // no point in showing repositories that we can't at least pull from
      const pullableRepos = data.filter((repo: GitHubRepository) => repo.permissions.pull);
      setRepositories(repos => ([...repos, ...pullableRepos]));
      const link = response.headers.get('link');
      if (link && link.includes('rel="last"')) {
        const last = link.match(/<([^>]+)>; rel="last"/)?.[1];
        if (last) {
          const lastUrl = new URL(last);
          const lastPage = lastUrl.searchParams.get('page');
          if (lastPage) {
            const pages = Number(lastPage);
            const pageList = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetch(`${GITHUB_USER_REPOS_URL}?per_page=100&page=${i + 2}`, fetchOpts)));
            for (const page of pageList) {
              const pageData = await page.json();
              setRepositories(repos => ([...repos, ...pageData]));
              setLoading(false);
            }
            return;
          }
        }
      }
      if (link && link.includes('rel="next"')) {
        const next = link.match(/<([^>]+)>; rel="next"/)?.[1];
        fetchRepositories(next);
        return;
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      showError({
        error,
        title: 'Failure listing GitHub repositories',
        message: error.message.split('\n')[0],
      });
    }
  }, [fetchOpts]);

  useEffect(() => {

    if (!token || uri) {
      return;
    }

    setLoading(true);

    fetchRepositories();
  }, [token, uri, fetchRepositories]);

  useEffect(() => {
    if (!uri) {
      setCannotFindRepository(false);
      return;
    }
    if ((!selectedRepository) && token && isGitHubAppUserToken(token)) {
      const [owner, name] = uri.replace('.git', '').split('/').slice(-2); // extracts the owner + name
      const apiUrl = `${getGitHubRestApiUrl()}/repos/${owner}/${name}`;
      fetch(apiUrl, fetchOpts)
        .then(response => {
          setCannotFindRepository(response.status === 404);
          if (response.ok) {
            return response.json();
          }
          return null;
        }).then(setSelectedRepository);
      return;
    }
  }, [selectedRepository, token, uri, fetchOpts]);

  return (
    <>
      <h2 className="font-bold">Repository</h2>
      {uri && <div className='form-control form-control--outlined'><input className="form-control" disabled defaultValue={uri} /></div>}
      {loading ? <div>Loading repositories... <Icon icon="spinner" className="animate-spin" /></div> : !uri && <><div className="flex flex-row items-center gap-2">
        <ComboBox
          aria-label="Repositories"
          allowsCustomValue={false}
          className="flex-[1]"
          defaultItems={repositories.map(repo => ({
            id: repo.clone_url,
            name: repo.full_name,
          }))}
          onSelectionChange={(key => setSelectedRepository(repositories.find(r => r.clone_url === key) || null))}
        >
          <div className='my-2 flex items-center gap-2 group rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors'>
            <Input aria-label='Repository Search' placeholder='Find a repository...' className="py-1 placeholder:italic w-full pl-2 pr-7 " />
            <ComboButton id="github_repo_select_dropdown_button" type="button" className="!border-none m-2 aspect-square gap-2 truncate flex items-center justify-center aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
              <Icon icon="caret-down" className='w-5 flex-shrink-0' />
            </ComboButton>
          </div>
          <Popover className="min-w-max border grid grid-flow-col overflow-hidden divide-x divide-solid divide-[--hl-md] select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] rounded-md focus:outline-none" placement='bottom start' offset={8}>
            <ListBox<{ id: string; name: string }>
              className="select-none text-sm min-w-max p-2 flex flex-col overflow-y-auto focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  textValue={item.name}
                  className="aria-disabled:opacity-30 aria-selected:bg-[--hl-sm] rounded aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] data-[focused]:bg-[--hl-xs] focus:outline-none transition-colors"
                >
                  <span className='truncate'>{item.name}</span>
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
          <input type="hidden" name="uri" value={selectedRepository?.clone_url || uri || ''} />
        </ComboBox>
        <Button
          type="button"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setRepositories([]);
            fetchRepositories();
          }}
        >
          <Icon icon="refresh" />
        </Button>
      </div>
        {isGitHubAppUserToken(token) &&
          <div className="flex gap-1 text-sm">
            Can't find a repository?
            <a className="underline text-purple-500" href={`${getAppWebsiteBaseURL()}/oauth/github-app`}>Configure the App <i className="fa-solid fa-up-right-from-square" /></a>
          </div>}
      </>}
      {cannotFindRepository && <div className="text-sm text-red-500"><Icon icon="warning" /> Repository information could not be retrieved. Please <code>Reset</code> and select a different repository.</div>}
      {selectedRepository !== null && !selectedRepository.permissions.push && <div className="text-sm text-orange-500 mt-2"><Icon icon="warning" /> You do not have write access to this repository</div>}
    </>
  );
};
