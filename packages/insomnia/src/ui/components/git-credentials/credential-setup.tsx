import React, { useState } from 'react';

import { Button } from '~/basic-components/button';
import { Card } from '~/basic-components/card';
import { Icon } from '~/basic-components/icon';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { GitCustomCredentialForm } from '~/ui/components/git-credentials/git-custom-credential-form';
import { GitCredentialModal } from '~/ui/components/settings/credentials';

interface Props {
  providers: GitProviderOption[];
}

export const GitCredentialSetup = ({ providers }: Props) => {
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [provider, setProvider] = useState<GitProviderOption>();
  const [showCustomCredentialForm, setShowCustomCredentialForm] = useState(false);

  const startGithubOAuth = () => {
    setProvider(providers.find(item => item.type === 'github'));
    setShowOAuthModal(true);
  };

  const startGitlabOAuth = () => {
    setProvider(providers.find(item => item.type === 'gitlab'));
    setShowOAuthModal(true);
  };

  if (showCustomCredentialForm) {
    return <GitCustomCredentialForm onCancel={() => setShowCustomCredentialForm(false)} />;
  }
  return (
    <>
      <Card className="flex flex-col items-center justify-center gap-4 text-center font-semibold">
        <div>Setup Git Credentials</div>
        <div className="w-[330px] text-xs font-normal">
          {'Credentials added here will be saved locally and can be managed later in Preferences > Credentials.'}
        </div>
        <div className="flex gap-2">
          <Button className="text-xs" onPress={startGithubOAuth} icon={<Icon icon={['fab', 'github']} />}>
            Login with Github
          </Button>
          <Button className="text-xs" onPress={startGitlabOAuth} icon={<Icon icon={['fab', 'gitlab']} />}>
            Login with Gitlab
          </Button>
        </div>
        <Button
          variant="text"
          className="text-xs"
          icon={<Icon icon="plus" />}
          onPress={() => setShowCustomCredentialForm(true)}
        >
          Add Access Token
        </Button>
      </Card>
      {showOAuthModal && provider && (
        <GitCredentialModal
          isOpen={showOAuthModal}
          onClose={() => {
            setShowOAuthModal(false);
          }}
          provider={provider}
        />
      )}
    </>
  );
};
