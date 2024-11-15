import React, { useCallback, useEffect, useState } from 'react';
import { Button as ComboButton, ComboBox, Input, ListBox, ListBoxItem, Popover } from 'react-aria-components';

// import { useFetcher, useParams } from 'react-router-dom';
import { getAppWebsiteBaseURL, getGitHubRestApiUrl } from '../../../../common/constants';
import { Icon } from '../../icon';
import { Button } from '../../themed-button';

// fragment of what we receive from the GitHub API
interface GitHubRepository {
  id: string;
  full_name: string;
  clone_url: string;
}

const GITHUB_USER_REPOS_URL = `${getGitHubRestApiUrl()}/user/repos`;

function isGitHubAppUserToken(token: string) {
  // old oauth tokens start with 'gho_' and app user tokens start with 'ghu_'
  return token.startsWith('ghu_');
}

export const GitHubRepositorySelect = (
  { uri, token }: {
    uri?: string;
    token: string;
  }) => {
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [selectedRepository, setSelectedRepository] = useState<GitHubRepository | null>(null);

  // this method assumes that GitHub will not change how it paginates this endpoint
  const fetchRepositories = useCallback(async (url: string = `${GITHUB_USER_REPOS_URL}?per_page=100`) => {
    try {
      const opts = {
        headers: {
          Authorization: `token ${token}`,
        },
      };
      const response = await fetch(url, opts);

      if (!response.ok) {
        throw new Error('Failed to fetch repositories');
      }

      const data = await response.json();
      setRepositories(repos => ([...repos, ...data]));
      const link = response.headers.get('link');
      if (link && link.includes('rel="last"')) {
        const last = link.match(/<([^>]+)>; rel="last"/)?.[1];
        if (last) {
          const lastUrl = new URL(last);
          const lastPage = lastUrl.searchParams.get('page');
          if (lastPage) {
            const pages = Number(lastPage);
            const pageList = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => fetch(`${GITHUB_USER_REPOS_URL}?per_page=100&page=${i + 2}`, opts)));
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
    } catch (err) {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token || uri) {
      return;
    }

    setLoading(true);

    fetchRepositories();
  }, [token, uri, fetchRepositories]);

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
        {isGitHubAppUserToken(token) && <div className="flex gap-1 text-sm">
          Can't find a repository?
          <a className="underline text-purple-500" href={`${getAppWebsiteBaseURL()}/oauth/github-app`}>Configure the App <i className="fa-solid fa-up-right-from-square" /></a>
        </div>}</>}
    </>
  );
};
