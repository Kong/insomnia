import { type FC, Fragment, useEffect, useState } from 'react';
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Separator,
  TextField,
} from 'react-aria-components';

import { Icon } from '~/basic-components/icon';
import { useAllConnectedReposLoaderFetcher } from '~/routes/git.all-connected-repos';
import type { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { useGitCredentialsLoaderFetcher } from '~/routes/git-credentials';
import { Checkbox } from '~/ui/components/base/checkbox';
import { GitRemoteBranchSelect } from '~/ui/components/git-credentials/git-remote-branch-select';
import { GitRepositorySelect } from '~/ui/components/git-credentials/git-repository-select';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';

import { type GitCredentials, isGitCredential } from '../../../models/git-credentials';
import { ErrorBoundary } from '../error-boundary';
import type { ActiveView, ProjectData } from './utils';

interface Props {
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
  projectData: ProjectData;
  initCloneGitRepositoryFetcher: ReturnType<typeof useGitProjectInitCloneActionFetcher>;
  organizationId: string;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
}

export const GitRepoForm: FC<Props> = ({
  setProjectData,
  projectData,
  initCloneGitRepositoryFetcher,
  organizationId,
  setActiveView,
}) => {
  const allConnectedReposLoaderFetcher = useAllConnectedReposLoaderFetcher();
  const allConnectedReposLoaderFetcherLoad = allConnectedReposLoaderFetcher.load;

  useEffect(() => {
    allConnectedReposLoaderFetcherLoad();
  }, [allConnectedReposLoaderFetcherLoad]);

  const allConnectedRepoURIProjectNameMap = allConnectedReposLoaderFetcher.data;

  const credentialsFetcher = useGitCredentialsLoaderFetcher();

  useEffect(() => {
    if (credentialsFetcher.state === 'idle' && !credentialsFetcher.data) {
      credentialsFetcher.load();
    }
  }, [credentialsFetcher]);

  const [isCredentialSelectOpen, setIsCredentialSelectOpen] = useState(false);

  const selectedCredentialsId = projectData.credentialsId || credentialsFetcher.data?.credentials[0]?._id;
  const selectedCredential = credentialsFetcher.data?.credentials.find(c => c._id === selectedCredentialsId);
  const selectedProvider = credentialsFetcher.data?.providers.find(p => p.type === selectedCredential?.provider);

  return (
    <ErrorBoundary>
      <Checkbox
        isSelected={projectData.connectRepositoryLater}
        onChange={isSelected => setProjectData(prev => ({ ...prev, connectRepositoryLater: isSelected }))}
        className="w-fit"
      >
        Connect repository later
      </Checkbox>

      {!projectData.connectRepositoryLater && credentialsFetcher.data && (
        <Form
          id="git-repo-form"
          onSubmit={async e => {
            e.preventDefault();

            const formData = new FormData(e.currentTarget);
            const credentialsId = formData.get('credentialsId') as string;
            const uri = formData.get('uri') as string;
            const ref = formData.get('ref') as string;

            setProjectData({
              ...projectData,
              credentialsId,
              uri,
              ref,
            });

            await initCloneGitRepositoryFetcher.submit({
              credentialsId,
              uri: uri || '',
              ref,
              organizationId,
            });

            setActiveView('git-results');
          }}
        >
          <Label className="group relative flex flex-col gap-2 px-0.5">
            <span className="pt-0 text-sm text-(--color-font)">Authorized as</span>
            <Select
              onOpenChange={setIsCredentialSelectOpen}
              isOpen={isCredentialSelectOpen}
              aria-label="Git Credentials"
              name="credentialsId"
              onSelectionChange={id =>
                setProjectData(prev => ({
                  ...prev,
                  credentialsId: id as string,
                }))
              }
              defaultSelectedKey={credentialsFetcher.data?.credentials[0]._id}
            >
              <Button className="flex w-full flex-1 items-center justify-between gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-(--color-font) ring-1 ring-transparent transition-colors placeholder:italic hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)">
                <SelectValue<GitCredentials> className="flex items-center justify-center gap-2 truncate">
                  {({ selectedItem }) => {
                    if (selectedItem) {
                      const provider = credentialsFetcher.data?.providers.find(p => p.type === selectedItem.provider);

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
                <ListBox
                  items={credentialsFetcher.data?.credentials}
                  className="min-w-max overflow-y-auto py-2 focus:outline-hidden"
                >
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
                        const provider = credentialsFetcher.data?.providers.find(p => p.type === item.provider);

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
          </Label>

          {selectedProvider && selectedProvider.supportsFetchRepos ? (
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
            <TextField
              name="uri"
              type="url"
              pattern="https?://.*\.git"
              defaultValue={projectData.uri}
              onChange={value => {
                let prefix = '';
                if (
                  selectedCredential &&
                  isGitCredential(selectedCredential) &&
                  selectedCredential.provider === 'custom' &&
                  selectedCredential.baseURI
                ) {
                  prefix = selectedCredential.baseURI.replace(/\/+$/, '') + '/';
                }

                setProjectData(prev => ({ ...prev, uri: prefix + value }));
              }}
              className="flex w-full flex-col gap-1 px-0.5"
              isRequired
            >
              <Label className="text-start text-sm">Git URI (https, including .git suffix)</Label>
              {selectedCredential &&
              isGitCredential(selectedCredential) &&
              selectedCredential.provider === 'custom' &&
              selectedCredential.baseURI ? (
                <div className="flex h-(--line-height-xxs) w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) p-0 pr-7 text-(--color-font) transition-colors placeholder:text-sm placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden">
                  <div className="flex h-full items-center bg-(--hl-sm) px-2 text-(--color-font)">
                    {selectedCredential.baseURI.replace(/\/+$/, '')}/
                  </div>
                  <Input className="flex-1 px-2" />
                </div>
              ) : (
                <Input
                  placeholder="https://gitlab.com/org/repo.git"
                  className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:text-sm placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
                />
              )}
              <FieldError className="text-xs text-(--color-danger)">
                {({ validationDetails, defaultChildren }) =>
                  validationDetails.patternMismatch
                    ? 'Please ensure the URL is valid and ends with a .git suffix.'
                    : defaultChildren
                }
              </FieldError>
            </TextField>
          )}

          <GitRemoteBranchSelect credentialsId={selectedCredentialsId} url={projectData.uri || ''} isDisabled={false} />
        </Form>
      )}
    </ErrorBoundary>
  );
};
