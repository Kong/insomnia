import { type FC, useEffect } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { isGitCredentialsOAuth } from '~/models/git-repository';
import { useAllConnectedReposLoaderFetcher } from '~/routes/git.all-connected-repos';
import type { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { Checkbox } from '~/ui/components/base/checkbox';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import { ErrorBoundary } from '../error-boundary';
import { CustomRepositorySettingsFormGroup } from '../git-credentials/custom-repository-settings-form';
import { GitHubRepositorySetupFormGroup } from '../git-credentials/github-repository-settings-form';
import { GitLabRepositorySetupFormGroup } from '../git-credentials/gitlab-repository-settings-form';
import type { ActiveView, ProjectData } from './utils';

interface Props {
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  projectData: ProjectData;
  initCloneGitRepositoryFetcher: ReturnType<typeof useGitProjectInitCloneActionFetcher>;
  organizationId: string;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
  selectedTab: OauthProviderName;
  setTab: React.Dispatch<React.SetStateAction<OauthProviderName>>;
}

export const GitRepoForm: FC<Props> = ({
  setProjectData,
  projectData,
  initCloneGitRepositoryFetcher,
  organizationId,
  setActiveView,
  selectedTab,
  setTab,
}) => {
  const onGitRepoFormSubmit = (gitRepositoryPatch: Partial<GitRepository & { ref?: string }>) => {
    const { author, credentials, created, modified, isPrivate, needsFullClone, uriNeedsMigration, ...repoPatch } =
      gitRepositoryPatch;

    setProjectData({
      ...projectData,
      ...credentials,
      authorName: author?.name || '',
      authorEmail: author?.email || '',
      uri: repoPatch.uri,
      ref: repoPatch.ref,
    });

    initCloneGitRepositoryFetcher.submit({
      ...repoPatch,
      authorName: author?.name || '',
      authorEmail: author?.email || '',
      ...(credentials
        ? isGitCredentialsOAuth(credentials)
          ? {
              credentials: {
                token: credentials.token || '',
                oauth2format: credentials.oauth2format || 'github',
                username: credentials.username || '',
              },
            }
          : {
              credentials,
            }
        : {
            credentials: {
              password: '',
              username: '',
            },
          }),
      uri: repoPatch.uri || '',
      organizationId,
    });

    setActiveView('git-results');
  };
  const allConnectedReposLoaderFetcher = useAllConnectedReposLoaderFetcher();
  const allConnectedReposLoaderFetcherLoad = allConnectedReposLoaderFetcher.load;
  useEffect(() => {
    allConnectedReposLoaderFetcherLoad();
  }, [allConnectedReposLoaderFetcherLoad]);
  const allConnectedRepoURIProjectNameMap = allConnectedReposLoaderFetcher.data;
  return (
    <ErrorBoundary>
      <Checkbox
        isSelected={projectData.connectRepositoryLater}
        onChange={isSelected => setProjectData(prev => ({ ...prev, connectRepositoryLater: isSelected }))}
        className="w-fit"
      >
        Connect repository later
      </Checkbox>
      {!projectData.connectRepositoryLater && (
        <Tabs
          selectedKey={selectedTab}
          onSelectionChange={key => {
            setTab(key as OauthProviderName);
          }}
          aria-label="Git repository settings tabs"
          className="flex h-full w-full flex-col"
        >
          <TabList
            className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
            aria-label="Request pane tabs"
          >
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="github"
            >
              <div className="flex items-center gap-2">
                <i className="fa fa-github" /> GitHub
              </div>
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="gitlab"
            >
              <div className="flex items-center gap-2">
                <i className="fa fa-gitlab" /> GitLab
              </div>
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="custom"
            >
              <div className="flex items-center gap-2">
                <i className="fa fa-code-fork" /> Git
              </div>
            </Tab>
          </TabList>
          <TabPanel className="h-full w-full overflow-y-auto py-2" id="github">
            <GitHubRepositorySetupFormGroup
              onSubmit={onGitRepoFormSubmit}
              allConnectedRepoURIProjectNameMap={allConnectedRepoURIProjectNameMap}
            />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto py-2" id="gitlab">
            <GitLabRepositorySetupFormGroup onSubmit={onGitRepoFormSubmit} />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto py-2" id="custom">
            <CustomRepositorySettingsFormGroup onSubmit={onGitRepoFormSubmit} />
          </TabPanel>
        </Tabs>
      )}
    </ErrorBoundary>
  );
};
