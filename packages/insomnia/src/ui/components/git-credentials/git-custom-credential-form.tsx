import { Form } from 'react-aria-components';

import { Button } from '~/basic-components/button';
import type { CustomGitCredentialV2 } from '~/insomnia-data';
import { useGitCredentialsUpdateActionFetcher } from '~/routes/git-credentials.$id.update';
import { useGitCredentialsCreateActionFetcher } from '~/routes/git-credentials.create';
import { Input } from '~/ui/components/base/input';

export const GitCustomCredentialForm = ({
  onCancel,
  onComplete,
  showTitle = true,
  gitCredentialToEdit,
}: {
  onCancel: () => void;
  onComplete?: () => void;
  showTitle?: boolean;
  gitCredentialToEdit?: CustomGitCredentialV2;
}) => {
  const createCredentialFetcher = useGitCredentialsCreateActionFetcher();
  const updateCredentialFetcher = useGitCredentialsUpdateActionFetcher();
  const isEditing = !!gitCredentialToEdit;
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const credentialData = {
      provider: 'custom' as const,
      author: {
        name: (formData.get('authorName') as string) || '',
        email: (formData.get('authorEmail') as string) || '',
      },
      credentials: {
        username: (formData.get('username') as string) || '',
        password: (formData.get('password') as string) || '',
        baseURI: (formData.get('baseURI') as string) || '',
      },
      name: 'Custom Git Credential',
    };

    await (isEditing && gitCredentialToEdit._id
      ? updateCredentialFetcher.submit(gitCredentialToEdit._id, credentialData)
      : createCredentialFetcher.submit(credentialData));
    onComplete?.();
  };

  return (
    <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      {showTitle && <div>{isEditing ? 'Edit Git credential' : 'Add Git credential'}</div>}
      <div className="flex flex-col gap-2.5">
        <div className="flex w-full gap-3">
          <Input
            name="authorEmail"
            type="email"
            isRequired
            className="w-1/2"
            label="Author Email"
            placeholder="e.g. john.doe@acme.com"
            defaultValue={gitCredentialToEdit?.author.email}
          />
          <Input
            isRequired
            name="authorName"
            className="w-1/2"
            label="Author Name"
            placeholder="e.g. John Doe"
            defaultValue={gitCredentialToEdit?.author.name}
          />
        </div>
        <div className="flex w-full gap-3">
          <Input
            name="username"
            isRequired
            className="w-1/2"
            label="Username"
            placeholder="remote username for PAT"
            defaultValue={gitCredentialToEdit?.credentials?.username}
          />
          <Input
            className="w-1/2"
            name="password"
            type="password"
            isRequired
            label="Git Access Token"
            placeholder="e.g. git_pat_11A11AAAAa111Aa11a1AA11"
            defaultValue={gitCredentialToEdit?.credentials?.password}
          />
        </div>
        <Input
          name="baseURI"
          type="url"
          isRequired
          label="Repository base URL"
          description="Specify the git server base URL that correlates with this access token."
          placeholder="e.g. https://github.your-domain.com/org-name"
          defaultValue={gitCredentialToEdit?.credentials?.baseURI}
        />
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
