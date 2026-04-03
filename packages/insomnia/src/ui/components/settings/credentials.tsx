import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  GridList,
  GridListItem,
  Heading,
  Label,
  ListBox,
  ListBoxItem,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components';

import { Button as BasicButton } from '~/basic-components/button';
import { Icon } from '~/basic-components/icon';
import type { GitCredentials, GitCredentialsV2, GitRemoteProviderType, ProviderEmail } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useGitCredentialsLoaderFetcher } from '~/routes/git-credentials';
import { useGitCredentialsDeleteActionFetcher } from '~/routes/git-credentials.$id.delete';
import { useRelatedProjectsByGitCredentialsIdLoaderFetcher } from '~/routes/git-credentials.$id.related-projects';
import { useGitCredentialsUpdateActionFetcher } from '~/routes/git-credentials.$id.update';
import {
  GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY,
  useGitProviderCompleteSignInFetcher,
} from '~/routes/git-credentials.complete-sign-in';
import { useInitSignInToGitProviderFetcher } from '~/routes/git-credentials.init-sign-in';
import { Input } from '~/ui/components/base/input';
import { GitCustomCredentialForm } from '~/ui/components/git-credentials/git-custom-credential-form';
import { showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { CloudServiceCredentialList } from '~/ui/components/settings/cloud-service-credentials';

const { isGitCredentialsV2, isOAuthCredential } = models.gitCredentials;

const getErrorResult = (data: any) => {
  if (data && 'errors' in data && Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.join(', ');
  }
  return null;
};

const getCredentialEmails = (credential: GitCredentials | undefined | null) => {
  if (credential && isGitCredentialsV2(credential) && isOAuthCredential(credential)) {
    return credential.credentials?.emails || [];
  }
  return [];
};

const GitEditProviderOAuthForm = ({
  provider,
  gitCredentialToEdit,
  onComplete,
  onCancel,
}: {
  provider: {
    type: GitRemoteProviderType;
    displayName: string;
    iconName?: IconProp;
  };
  gitCredentialToEdit?: GitCredentials | null;
  onComplete?: () => void;
  onCancel?: () => void;
}) => {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const initSignInFetcher = useInitSignInToGitProviderFetcher();
  const completeSignInFetcher = useGitProviderCompleteSignInFetcher({ key: GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY });
  const [isEmailSelectOpen, setIsEmailSelectOpen] = useState(false);

  const [selectedAuthorEmail, setSelectedAuthorEmail] = useState(gitCredentialToEdit?.author.email);
  const initSignInError = getErrorResult(initSignInFetcher.data);
  const completeSignInError = getErrorResult(completeSignInFetcher.data);

  const availableEmails = getCredentialEmails(gitCredentialToEdit);

  const prevCompleteSignInStateRef = useRef(completeSignInFetcher.state);
  useEffect(() => {
    const prevState = prevCompleteSignInStateRef.current;
    prevCompleteSignInStateRef.current = completeSignInFetcher.state;

    if (
      (prevState === 'submitting' || prevState === 'loading') &&
      completeSignInFetcher.state === 'idle' &&
      completeSignInFetcher.data &&
      !completeSignInError
    ) {
      onComplete?.();
    }
  }, [completeSignInFetcher.state, completeSignInFetcher.data, completeSignInError, onComplete]);

  const updateCredentialFetcher = useGitCredentialsUpdateActionFetcher();
  const isEditing = !!gitCredentialToEdit;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const name = (formData.get('authorName') as string) || '';
    const email = (formData.get('authorEmail') as string) || '';

    // Updates use shallow merge in the DB layer: a patch must not replace `credentials` with only
    // `selectedEmail` or we lose token, refreshToken, emails, etc. Merge from the existing credential.
    const credentialsPatch =
      gitCredentialToEdit && isGitCredentialsV2(gitCredentialToEdit) && isOAuthCredential(gitCredentialToEdit)
        ? {
            ...gitCredentialToEdit.credentials,
            selectedEmail: email,
          }
        : {
            selectedEmail: email,
          };

    const credentialData = {
      provider: provider.type as GitRemoteProviderType,
      author: {
        name,
        email,
        avatarUrl: gitCredentialToEdit?.author.avatarUrl,
      },
      credentials: credentialsPatch,
    };

    isEditing &&
      gitCredentialToEdit?._id &&
      updateCredentialFetcher.submit(gitCredentialToEdit._id, credentialData as Partial<GitCredentialsV2>);
    onComplete?.();
  };

  return (
    <div className="flex flex-col justify-center py-4">
      {!isAuthenticating && (
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2">
            {provider?.iconName && <Icon icon={provider.iconName} className="size-5" />}
            <span className="font-semibold text-nowrap">{provider?.displayName}</span>
            {gitCredentialToEdit?.author.avatarUrl ? (
              <img
                src={gitCredentialToEdit?.author.avatarUrl}
                alt={gitCredentialToEdit?.author.name || 'Avatar'}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--hl-sm) text-xs font-bold text-(--color-font-muted)">
                {gitCredentialToEdit?.author.name ? gitCredentialToEdit?.author.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <span>{gitCredentialToEdit?.author.name}</span>
            <Button
              className="text-(--color-surprise)"
              onPress={() => {
                setIsAuthenticating(true);
                initSignInFetcher.submit({ provider: provider.type });
              }}
            >
              Reauthorize
            </Button>
          </div>
          <div className="mt-4 flex w-full flex-col gap-2">
            <Input name="authorName" isRequired label="Author Name" defaultValue={gitCredentialToEdit?.author.name} />
            <Select
              onOpenChange={setIsEmailSelectOpen}
              isOpen={isEmailSelectOpen}
              aria-label="Author Email"
              selectedKey={selectedAuthorEmail}
              name="authorEmail"
              onSelectionChange={email => {
                setSelectedAuthorEmail(email?.toString());
              }}
            >
              <Label className="mb-2 px-0.5 pt-0 text-sm">Author Email</Label>
              <Button className="flex w-full flex-1 items-center justify-between gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-(--color-font) ring-1 ring-transparent transition-colors placeholder:italic hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)">
                <SelectValue<ProviderEmail> className="flex items-center justify-center gap-2 truncate">
                  {({ selectedItem }) => {
                    if (selectedItem) {
                      return (
                        <Fragment>
                          <span>{selectedItem.email}</span>
                          {selectedItem.primary && <span className="text-xs text-(--hl-lg)">(primary)</span>}
                        </Fragment>
                      );
                    }
                    return gitCredentialToEdit?.author.email || 'Select an email';
                  }}
                </SelectValue>
                <Icon icon="caret-down" />
              </Button>
              <Popover className="isolate flex w-(--trigger-width) min-w-max flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none">
                <ListBox items={availableEmails} className="min-w-max overflow-y-auto py-2 focus:outline-hidden">
                  {item => (
                    <ListBoxItem
                      id={item.email}
                      key={item.email}
                      className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                      aria-label={item.email}
                      textValue={item.email}
                      value={item}
                    >
                      {({ isSelected }) => (
                        <Fragment>
                          <span>{item.email}</span>
                          {item.primary && <span className="text-xs text-(--hl-lg)">(primary)</span>}
                          {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                        </Fragment>
                      )}
                    </ListBoxItem>
                  )}
                </ListBox>
              </Popover>
            </Select>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <BasicButton primary type="submit">
              Update Credential
            </BasicButton>
            <BasicButton onPress={onCancel}>Cancel</BasicButton>
          </div>
        </form>
      )}
      {isAuthenticating && (
        <form
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            const formData = new FormData(event.currentTarget);
            const link = formData.get('link');
            if (typeof link === 'string') {
              let parsedURL: URL;
              try {
                parsedURL = new URL(link);
              } catch {
                setError('Invalid URL');
                return;
              }

              const code = parsedURL.searchParams.get('code');
              const state = parsedURL.searchParams.get('state');

              if (!(typeof code === 'string') || !(typeof state === 'string')) {
                setError('Incomplete URL');
                return;
              }

              completeSignInFetcher.submit({ provider: provider.type, code, state, isEditing });
            }
          }}
        >
          <label className="form-control form-control--outlined">
            <div>If you aren't redirected to the app you can manually paste the authentication url here:</div>
            <div className="flex justify-between gap-2">
              <input name="link" />
              <Button
                type="submit"
                name="add-token"
                className="flex h-(--line-height-xs) items-center justify-center rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--color-surprise)/80"
              >
                Authenticate
              </Button>
            </div>
          </label>
          {error && (
            <p className="notice error margin-bottom-sm">
              <Button className="pull-right icon" onPress={() => setError('')}>
                <Icon icon="times" className="size-4" />
              </Button>
              {error}
            </p>
          )}
          {(initSignInError || completeSignInError) && (
            <p className="margin-bottom-sm flex items-start gap-2 rounded-xs border border-solid border-(--color-danger) bg-(--color-danger-bg) p-2 text-(--color-danger)">
              <Icon icon="exclamation-triangle" className="mt-1 size-4" />
              <span>{initSignInError || completeSignInError}</span>
            </p>
          )}
        </form>
      )}
    </div>
  );
};

const GitProviderOAuthForm = ({
  provider,
  onComplete,
}: {
  provider: {
    type: GitRemoteProviderType;
    displayName: string;
    iconName?: IconProp;
  };
  onComplete?: () => void;
}) => {
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const initSignInFetcher = useInitSignInToGitProviderFetcher();
  const completeSignInFetcher = useGitProviderCompleteSignInFetcher({ key: GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY });

  const initSignInError = getErrorResult(initSignInFetcher.data);
  const completeSignInError = getErrorResult(completeSignInFetcher.data);

  const prevCompleteSignInStateRef = useRef(completeSignInFetcher.state);
  useEffect(() => {
    const prevState = prevCompleteSignInStateRef.current;
    prevCompleteSignInStateRef.current = completeSignInFetcher.state;

    if (
      (prevState === 'submitting' || prevState === 'loading') &&
      completeSignInFetcher.state === 'idle' &&
      completeSignInFetcher.data &&
      !completeSignInError
    ) {
      onComplete?.();
    }
  }, [completeSignInFetcher.state, completeSignInFetcher.data, completeSignInError, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center border border-solid border-(--hl-sm) p-4">
      <Button
        className="flex items-center gap-2 disabled:opacity-100"
        type="button"
        isDisabled={isAuthenticating}
        onPress={() => {
          setIsAuthenticating(true);
          initSignInFetcher.submit({ provider: provider.type });
        }}
      >
        {provider.iconName && <Icon icon={provider.iconName} className="size-5" />}
        {isAuthenticating
          ? `Authenticating with ${provider.displayName} App`
          : `Authenticate with ${provider.displayName} App`}
      </Button>

      {isAuthenticating && (
        <form
          onSubmit={event => {
            event.preventDefault();
            event.stopPropagation();
            const formData = new FormData(event.currentTarget);
            const link = formData.get('link');
            if (typeof link === 'string') {
              let parsedURL: URL;
              try {
                parsedURL = new URL(link);
              } catch {
                setError('Invalid URL');
                return;
              }

              const code = parsedURL.searchParams.get('code');
              const state = parsedURL.searchParams.get('state');

              if (!(typeof code === 'string') || !(typeof state === 'string')) {
                setError('Incomplete URL');
                return;
              }

              completeSignInFetcher.submit({ provider: provider.type, code, state });
            }
          }}
        >
          <label className="form-control form-control--outlined">
            <div>If you aren't redirected to the app you can manually paste the authentication url here:</div>
            <div className="flex justify-between gap-2">
              <input name="link" />
              <Button
                type="submit"
                name="add-token"
                className="flex h-(--line-height-xs) items-center justify-center rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--color-surprise)/80"
              >
                Authenticate
              </Button>
            </div>
          </label>
          {error && (
            <p className="notice error margin-bottom-sm">
              <Button className="pull-right icon" onPress={() => setError('')}>
                <Icon icon="times" className="size-4" />
              </Button>
              {error}
            </p>
          )}
          {(initSignInError || completeSignInError) && (
            <p className="margin-bottom-sm flex items-start gap-2 rounded-xs border border-solid border-(--color-danger) bg-(--color-danger-bg) p-2 text-(--color-danger)">
              <Icon icon="exclamation-triangle" className="mt-1 size-4" />
              <span>{initSignInError || completeSignInError}</span>
            </p>
          )}
        </form>
      )}
    </div>
  );
};

export const GitCredentialModal = ({
  isOpen,
  onClose,
  provider,
  gitCredentialToEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  provider: {
    type: GitRemoteProviderType;
    displayName: string;
    iconName?: IconProp;
  } | null;
  gitCredentialToEdit?: GitCredentials | null;
}) => {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      isDismissable
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal className="max-h-full w-full max-w-2xl rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)">
        <Dialog className="outline-hidden">
          {({ close }) => (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <Heading className="text-2xl">
                  {gitCredentialToEdit ? 'Edit' : 'Add a new'} {provider?.displayName} Credential
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              {!gitCredentialToEdit && (
                <>
                  {!provider || provider.type === 'custom' ? (
                    <GitCustomCredentialForm onCancel={close} onComplete={onClose} />
                  ) : null}
                  {provider && provider.type !== 'custom' && (
                    <GitProviderOAuthForm onComplete={onClose} provider={provider} />
                  )}
                </>
              )}
              {gitCredentialToEdit &&
                isGitCredentialsV2(gitCredentialToEdit) &&
                gitCredentialToEdit.provider !== 'custom' &&
                provider &&
                provider.type !== 'custom' && (
                  <GitEditProviderOAuthForm
                    onComplete={onClose}
                    onCancel={close}
                    provider={provider}
                    gitCredentialToEdit={gitCredentialToEdit}
                  />
                )}
              {gitCredentialToEdit &&
                isGitCredentialsV2(gitCredentialToEdit) &&
                gitCredentialToEdit.provider === 'custom' &&
                provider?.type === 'custom' && (
                  <GitCustomCredentialForm
                    gitCredentialToEdit={gitCredentialToEdit}
                    onCancel={close}
                    onComplete={onClose}
                    showTitle={false}
                  />
                )}
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const GitCredentialsList = () => {
  const [gitCredentialToEdit, setGitCredentialToEdit] = useState<GitCredentialsV2 | null>(null);
  const credentialsFetcher = useGitCredentialsLoaderFetcher();
  const deleteCredentialFetcher = useGitCredentialsDeleteActionFetcher();
  const deleteCredentialFetcherSubmit = deleteCredentialFetcher.submit;
  const relatedProjectsFetcher = useRelatedProjectsByGitCredentialsIdLoaderFetcher();
  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const pendingDeleteCredentialIdRef = useRef<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<{
    type: GitRemoteProviderType;
    displayName: string;
    iconName?: IconProp;
  } | null>(null);
  const completeSignInFetcher = useGitProviderCompleteSignInFetcher({ key: GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY });
  const prevCompleteSignInStateRef = useRef(completeSignInFetcher.state);

  useEffect(() => {
    if (credentialsFetcher.state === 'idle' && !credentialsFetcher.data) {
      credentialsFetcher.load();
    }
  }, [credentialsFetcher]);

  // Auto-close modal and reload credentials when OAuth sign-in completes (CREATE or EDIT via deep link)
  useEffect(() => {
    const prevState = prevCompleteSignInStateRef.current;
    prevCompleteSignInStateRef.current = completeSignInFetcher.state;

    const completeSignInError = getErrorResult(completeSignInFetcher.data);
    if (
      (prevState === 'submitting' || prevState === 'loading') &&
      completeSignInFetcher.state === 'idle' &&
      completeSignInFetcher.data &&
      !completeSignInError &&
      isCredentialModalOpen
    ) {
      setIsCredentialModalOpen(false);
      credentialsFetcher.load();
    }
  }, [completeSignInFetcher.state, completeSignInFetcher.data, isCredentialModalOpen, credentialsFetcher]);

  // Handle delete confirmation when related projects data is loaded
  useEffect(() => {
    if (
      pendingDeleteCredentialIdRef.current &&
      relatedProjectsFetcher.state === 'idle' &&
      relatedProjectsFetcher.data
    ) {
      const credentialIdToDelete = pendingDeleteCredentialIdRef.current;
      const projects = relatedProjectsFetcher.data.projects || [];

      if (projects.length > 0) {
        showModal(AlertModal, {
          title: 'Cannot Delete Git Credential',
          message: (
            <div className="flex flex-col gap-4">
              <p>This git credential is currently being used by the following projects:</p>
              <ul className="flex flex-col gap-2 rounded-md border border-solid border-(--hl-md) bg-(--hl-xs) p-4">
                {projects.map(({ name, _id }) => (
                  <li key={_id} className="flex items-center gap-2">
                    <Icon icon="folder" className="text-(--color-font)" />
                    <span className="font-medium">{name}</span>
                  </li>
                ))}
              </ul>
              <p className="text-(--color-font-muted)">
                Please disconnect or delete these projects before removing this credential.
              </p>
            </div>
          ),
          okLabel: 'OK',
          addCancel: false,
        });
      } else {
        showModal(AlertModal, {
          title: 'Delete Git Credential',
          message:
            "Are you sure you want to delete this Git credential? You won't be able to use it to connect new Git Sync projects to the repositories it provides access to.",
          okLabel: 'Delete',
          addCancel: true,
          onConfirm: async () => {
            deleteCredentialFetcherSubmit({ id: credentialIdToDelete });
          },
        });
      }

      pendingDeleteCredentialIdRef.current = null;
    }
  }, [relatedProjectsFetcher.state, relatedProjectsFetcher.data, deleteCredentialFetcherSubmit]);

  return (
    <div className="mb-4 flex flex-col gap-2 py-4">
      <div className="flex items-center justify-between gap-2">
        <Heading className="text-lg font-bold">Git Credentials</Heading>
        <MenuTrigger>
          <Button
            aria-label="Create Git Credential"
            className="flex h-full items-center justify-center gap-2 rounded-xs bg-(--hl-xxs) px-4 py-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <Icon icon="plus-circle" /> Add Credential
          </Button>
          <Popover className="min-w-max" placement="bottom right">
            <Menu
              aria-label="Create git credential actions"
              selectionMode="single"
              onAction={key => {
                const provider = credentialsFetcher.data?.providers.find(p => p.id === key);
                if (provider) {
                  setSelectedProvider({
                    type: provider.type,
                    displayName: provider.displayName,
                    iconName: provider.iconName,
                  });
                  setGitCredentialToEdit(null);
                  setIsCredentialModalOpen(true);
                }
              }}
              items={credentialsFetcher.data?.providers || []}
              className="max-h-[85vh] min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
            >
              {item => (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  className="flex h-(--line-height-xxs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.displayName}
                >
                  {item.iconName && <Icon icon={item.iconName} className="size-5" />}
                  <span>{item.displayName}</span>
                </MenuItem>
              )}
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>

      {credentialsFetcher.data?.credentials.length === 0 && (
        <p className="text-center">No Git credentials configured</p>
      )}

      <GridList
        items={credentialsFetcher.data?.credentials || []}
        aria-label="Git credentials list"
        className="flex flex-col gap-4"
      >
        {item => {
          const provider = credentialsFetcher.data?.providers.find(p => p.type === item.provider);
          return (
            <GridListItem
              id={item._id}
              className="flex flex-col gap-2 rounded-md border border-solid border-(--hl-sm) p-2"
              textValue={item.name || 'Credentials Item'}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {provider?.iconName && <Icon icon={provider.iconName} className="size-5" />}
                  <span className="font-semibold text-nowrap">{provider?.displayName}</span>
                  {item.author.avatarUrl ? (
                    <img
                      src={item.author.avatarUrl}
                      alt={item.author.name || 'Avatar'}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--hl-sm) text-xs font-bold text-(--color-font-muted)">
                      {item.author.name ? item.author.name.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                  <span>{item.author.name}</span>
                  <span>{item.author.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isGitCredentialsV2(item) && provider && (
                    <Button
                      className="h-7 rounded-xs px-2 py-1 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) disabled:opacity-50 aria-pressed:bg-(--hl-sm)"
                      onPress={() => {
                        setSelectedProvider({
                          type: provider.type,
                          displayName: provider.displayName,
                          iconName: provider.iconName,
                        });
                        setGitCredentialToEdit(item);
                        setIsCredentialModalOpen(true);
                      }}
                    >
                      <Icon icon="edit" /> Edit
                    </Button>
                  )}
                  <Button
                    onPress={() => {
                      pendingDeleteCredentialIdRef.current = item._id;
                      relatedProjectsFetcher.load({ gitCredentialsId: item._id });
                    }}
                    className="h-7 rounded-xs px-2 py-1 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) disabled:opacity-50 aria-pressed:bg-(--hl-sm)"
                  >
                    <Icon icon="trash" /> Delete
                  </Button>
                </div>
              </div>
            </GridListItem>
          );
        }}
      </GridList>
      {selectedProvider && (
        <GitCredentialModal
          gitCredentialToEdit={gitCredentialToEdit}
          isOpen={isCredentialModalOpen}
          onClose={() => {
            setIsCredentialModalOpen(false);
          }}
          provider={selectedProvider}
        />
      )}
    </div>
  );
};

export const CredentialsSettings = () => {
  return (
    <div>
      <GitCredentialsList />
      <CloudServiceCredentialList />
    </div>
  );
};
