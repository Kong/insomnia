import { Form } from 'react-aria-components';

import { Button } from '~/basic-components/button';
import { useGitCredentialsCreateActionFetcher } from '~/routes/git-credentials.create';
import { Input } from '~/ui/components/base/input';

export const GitCustomCredentialForm = ({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete?: () => void;
}) => {
  const createCredentialFetcher = useGitCredentialsCreateActionFetcher();
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    await createCredentialFetcher.submit({
      provider: 'custom',
      author: {
        name: (formData.get('authorName') as string) || '',
        email: (formData.get('authorEmail') as string) || '',
      },
      username: (formData.get('username') as string) || '',
      password: (formData.get('password') as string) || '',
      baseURI: (formData.get('baseURI') as string) || '',
    });
    onComplete?.();
  };

  return (
    <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div>Add Git credential</div>
      <div className="flex flex-col gap-2.5">
        <div className="flex w-full gap-3">
          <Input
            name="authorEmail"
            type="email"
            isRequired
            className="w-1/2"
            label="Your Email"
            placeholder="e.g. your-name@acme.com"
          />
          <Input isRequired name="authorName" className="w-1/2" label="Your Git Username" placeholder="e.g. git-user" />
        </div>
        <div className="flex w-full gap-3">
          <Input name="username" isRequired className="w-1/2" label="Username" placeholder="remote username for PAT" />
          <Input
            className="w-1/2"
            name="password"
            isRequired
            label="Git Access Token"
            placeholder="e.g. github_pat_11A11AAAAa111Aa11a1AA11"
          />
        </div>
        <Input
          name="baseURI"
          type="url"
          isRequired
          label="Repository base URL"
          description="Specify the git server base URL that correlates with this access token."
          placeholder="e.g. https://github.your-domain.com/org-name"
        />
      </div>
      <div className="flex gap-2">
        <Button primary type="submit">
          Save Credential
        </Button>
        <Button onPress={onCancel}>Cancel</Button>
      </div>
    </Form>
  );
};
