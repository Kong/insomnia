import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import { Icon } from '~/basic-components/icon';
import type { OauthProviderName } from '~/models/git-repository';

export const GitProviderTag = ({ provider }: { provider: OauthProviderName }) => {
  const icon: Record<OauthProviderName, IconProp> = {
    github: ['fab', 'github'],
    gitlab: ['fab', 'gitlab'],
    custom: 'code-branch',
  };
  return (
    <div>
      <Icon className="mr-1" icon={icon[provider]} />
      {provider}
    </div>
  );
};
