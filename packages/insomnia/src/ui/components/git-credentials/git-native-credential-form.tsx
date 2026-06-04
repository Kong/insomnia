import { Form } from 'react-aria-components';

import { Button } from '~/basic-components/button';
import type { GitCredentialsV2, NativeGitCredential } from '~/insomnia-data';
import { useGitCredentialsUpdateActionFetcher } from '~/routes/git-credentials.$id.update';
import { useGitCredentialsCreateActionFetcher } from '~/routes/git-credentials.create';
import { Input } from '~/ui/components/base/input';

export const GitNativeCredentialForm = ({
  onCancel,
  onComplete,
  showTitle = true,
  gitCredentialToEdit,
}: {
  onCancel: () => void;
  onComplete?: () => void;
  showTitle?: boolean;
  gitCredentialToEdit?: GitCredentialsV2 & NativeGitCredential;
}) => {
  const createCredentialFetcher = useGitCredentialsCreateActionFetcher();
  const updateCredentialFetcher = useGitCredentialsUpdateActionFetcher();
  const isEditing = !!gitCredentialToEdit;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);

    const credentialData = {
      provider: 'native' as const,
      name: (formData.get('label') as string) || 'System Git Credentials',
      author: {
        name: (formData.get('authorName') as string) || '',
        email: (formData.get('authorEmail') as string) || '',
      },
    };

    await (isEditing && gitCredentialToEdit._id
      ? updateCredentialFetcher.submit(gitCredentialToEdit._id, credentialData)
      : createCredentialFetcher.submit(credentialData));
    onComplete?.();
  };

  return (
    <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {showTitle && <div>{isEditing ? 'Edit system git credential' : 'Use system git credential manager'}</div>}
      <p className="text-xs text-(--color-font-muted)">
        Insomnia will use your system&apos;s git credential manager (macOS Keychain, Windows Credential Manager,
        git-credential-manager, etc.) for authentication. No token is stored in Insomnia.
      </p>
      <div className="flex flex-col gap-2.5">
        <Input name="label" label="Label" placeholder="e.g. Work laptop" defaultValue={gitCredentialToEdit?.name} />
        <div className="flex w-full gap-3">
          <Input
            name="authorEmail"
            type="email"
            isRequired
            className="w-1/2"
            label="Author Email"
            placeholder="e.g. john.doe@acme.com"
            defaultValue={gitCredentialToEdit?.author?.email}
          />
          <Input
            isRequired
            name="authorName"
            className="w-1/2"
            label="Author Name"
            placeholder="e.g. John Doe"
            defaultValue={gitCredentialToEdit?.author?.name}
          />
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button primary type="submit">
          {isEditing ? 'Update Credential' : 'Save Credential'}
        </Button>
        <Button onPress={onCancel}>Cancel</Button>
      </div>
    </Form>
  );
};
