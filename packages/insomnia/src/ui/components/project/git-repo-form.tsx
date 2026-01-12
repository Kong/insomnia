import { type FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  Form,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Separator,
} from 'react-aria-components';

import { Icon } from '~/basic-components/icon';
import { useAllConnectedReposLoaderFetcher } from '~/routes/git.all-connected-repos';
import type { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { Checkbox } from '~/ui/components/base/checkbox';
import { Input } from '~/ui/components/base/input';
import { GitCredentialSetup } from '~/ui/components/git-credentials/credential-setup';
import { GitRemoteBranchSelect } from '~/ui/components/git-credentials/git-remote-branch-select';
import { GitRepositorySelect } from '~/ui/components/git-credentials/git-repository-select';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

import { type GitCredentials, isGitCredentialsV2 } from '../../../models/git-credentials';
import { ErrorBoundary } from '../error-boundary';
import type { ActiveView, ProjectData } from './utils';

const getDisplayValue = (fullUri: string | undefined, prefix: string | undefined) => {
  if (!fullUri) return '';
  if (prefix && fullUri.startsWith(prefix)) {
    return fullUri.slice(prefix.length);
  }
  return fullUri;
};

interface Props {
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  projectData: ProjectData;
  initCloneGitRepositoryFetcher: ReturnType<typeof useGitProjectInitCloneActionFetcher>;
  organizationId: string;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
  credentials: GitCredentials[];
  providers: GitProviderOption[];
  formId: string;
}

export const GitRepoForm: FC<Props> = ({
  setProjectData,
  projectData,
  initCloneGitRepositoryFetcher,
  organizationId,
  setActiveView,
  credentials,
  providers,
  formId,
}) => {
  const allConnectedReposLoaderFetcher = useAllConnectedReposLoaderFetcher();
  const allConnectedReposLoaderFetcherLoad = allConnectedReposLoaderFetcher.load;

  useEffect(() => {
    allConnectedReposLoaderFetcherLoad();
  }, [allConnectedReposLoaderFetcherLoad]);

  const allConnectedRepoURIProjectNameMap = allConnectedReposLoaderFetcher.data;

  const [isCredentialSelectOpen, setIsCredentialSelectOpen] = useState(false);

  const selectedCredentialsId = projectData.credentialsId || credentials?.[0]?._id;
  const selectedCredential = credentials.find(c => c._id === selectedCredentialsId);
  const selectedProvider = providers.find(p => p.type === selectedCredential?.provider);
  const needToSetupCredentials = credentials.length === 0;
  const baseURI =
    (selectedCredential &&
      isGitCredentialsV2(selectedCredential) &&
      selectedCredential.provider === 'custom' &&
      selectedCredential.credentials?.baseURI) ||
    '';

  return (
    <ErrorBoundary>
      <Checkbox
        isSelected={projectData.connectRepositoryLater}
        onChange={isSelected => setProjectData(prev => ({ ...prev, connectRepositoryLater: isSelected }))}
        className="w-fit"
      >
        Connect repository later
      </Checkbox>

      {needToSetupCredentials && !projectData.connectRepositoryLater && <GitCredentialSetup providers={providers} />}

      {!needToSetupCredentials && !projectData.connectRepositoryLater && (
        <Form
          id={formId}
          className="flex flex-col gap-4"
          onSubmit={async e => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const credentialsId = formData.get('credentialsId') as string;
            const uri = formData.get('uri') as string;
            const ref = formData.get('branch') as string;
            const prefix = baseURI ? baseURI.replace(/\/+$/, '') + '/' : '';
            const fullUri = prefix ? `${prefix}${uri}` : uri;
            setProjectData({
              ...projectData,
              credentialsId,
              uri: fullUri,
              ref,
            });
            initCloneGitRepositoryFetcher.submit({
              credentialsId,
              uri: fullUri || '',
              ref,
              organizationId,
            });

            setActiveView('git-results');
          }}
        >
          {/* TODO support custom children in base select component and replace this one */}
          <Select
            onOpenChange={setIsCredentialSelectOpen}
            isOpen={isCredentialSelectOpen}
            aria-label="Git Credentials"
            name="credentialsId"
            onSelectionChange={id => {
              setProjectData(prev => ({
                ...prev,
                credentialsId: id as string,
              }));
            }}
            defaultSelectedKey={credentials?.[0]?._id}
          >
            <Label className="mb-2 px-0.5 pt-0 text-sm">Authorized as</Label>
            <Button className="flex w-full flex-1 items-center justify-between gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-(--color-font) ring-1 ring-transparent transition-colors placeholder:italic hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)">
              <SelectValue<GitCredentials> className="flex items-center justify-center gap-2 truncate">
                {({ selectedItem }) => {
                  if (selectedItem) {
                    const provider = providers.find(p => p.type === selectedItem.provider);

                    return (
                      <Fragment>
                        {provider?.iconName && <Icon icon={provider.iconName} className="size-4" />}
                        <span>{provider?.displayName}</span>
                        <Separator orientation="vertical" className="mx-2 h-4 border-l border-(--color-font)" />
                        <span className="truncate">{selectedItem.author.name}</span>
                        <span className="truncate">{selectedItem.author.email}</span>
                      </Fragment>
                    );
                  }

                  return 'Select a Credential';
                }}
              </SelectValue>
              <Icon icon="caret-down" />
            </Button>
            <Popover className="isolate flex w-(--trigger-width) min-w-max flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none">
              <ListBox items={credentials} className="min-w-max overflow-y-auto py-2 focus:outline-hidden">
                {item => (
                  <ListBoxItem
                    id={item._id}
                    key={item._id}
                    className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                    aria-label={item.name}
                    textValue={item.name}
                    value={item}
                  >
                    {({ isSelected }) => {
                      const provider = providers.find(p => p.type === item.provider);

                      return (
                        <Fragment>
                          {provider?.iconName && <Icon icon={provider.iconName} className="size-4" />}
                          <span>{provider?.displayName}</span>
                          <Separator orientation="vertical" className="mx-2 h-4 border-l border-(--color-font)" />
                          <span className="truncate">{item.author.name}</span>
                          <span className="truncate">{item.author.email}</span>
                          {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                        </Fragment>
                      );
                    }}
                  </ListBoxItem>
                )}
              </ListBox>
              <div className="w-(--trigger-width) bg-(--hl-xs) p-4 text-sm text-(--color-font)">
                <span className="font-bold">Need to add another credential? </span>
                <span>Login with Github or GitLab, or manually add access tokens in </span>
                <Button
                  onPress={() => {
                    setIsCredentialSelectOpen(false);
                    showSettingsModal({ tab: 'credentials' });
                  }}
                  className="underline"
                >
                  {'Preferences > Credentials.'}
                </Button>
              </div>
            </Popover>
          </Select>
          {selectedProvider && (
            <>
              {selectedProvider.supportsFetchRepos ? (
                <GitRepositorySelect
                  allConnectedRepoURIProjectNameMap={allConnectedRepoURIProjectNameMap}
                  uri={projectData.uri || ''}
                  onSelect={(uri: string) =>
                    setProjectData(prev => ({
                      ...prev,
                      uri,
                    }))
                  }
                  credentialsId={selectedCredentialsId}
                />
              ) : (
                <Input
                  label="Path to Repository"
                  description="Note: Some repo should include “.git” at the end of the path."
                  prefix={baseURI}
                  key={selectedCredentialsId}
                  defaultValue={getDisplayValue(projectData.uri, baseURI)}
                  name="uri"
                  type={baseURI ? 'text' : 'url'}
                  isRequired
                  onChange={async v => {
                    const prefix = baseURI ? baseURI.replace(/\/+$/, '') + '/' : '';
                    const fullUri = prefix ? `${prefix}${v}` : v;
                    setProjectData(prev => ({ ...prev, uri: fullUri }));
                  }}
                />
              )}
            </>
          )}

          <GitRemoteBranchSelect credentialsId={selectedCredentialsId} url={projectData.uri || ''} isDisabled={false} />
        </Form>
      )}
    </ErrorBoundary>
  );
};
