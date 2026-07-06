import type { StorageRules } from 'insomnia-api';
import { models } from 'insomnia-data';
import { useParams } from 'react-router';

import { Banner } from '~/basic-components/banner';
import { Button } from '~/basic-components/button';
import { LearnMoreLink } from '~/basic-components/link';
import { getAppWebsiteBaseURL } from '~/common/constants';
import { docsPricingLearnMoreLink } from '~/common/documentation';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import type { ProjectType } from '~/ui/components/project/utils';
import { useIsLightTheme } from '~/ui/hooks/theme';

interface Props {
  isGitSyncEnabled: boolean;
  storageType?: ProjectType;
  storageRules: StorageRules;
}
export const ProjectTypeWarning = ({ isGitSyncEnabled, storageType, storageRules }: Props) => {
  const isLightTheme = useIsLightTheme();
  const showStorageRestrictionMessage =
    !storageRules.enableCloudSync || !storageRules.enableLocalVault || !storageRules.enableGitSync;
  const organizationData = useOrganizationLoaderData();
  const { userSession } = useRootLoaderData()!;
  const { organizationId } = useParams() as { organizationId: string };
  const organization = organizationData?.organizations.find(o => o.id === organizationId);
  // TODO: extract to a hook later
  const isUserOwner =
    organization &&
    userSession.accountId &&
    models.organization.isOwnerOfOrganization({ organization, accountId: userSession.accountId });
  return (
    <>
      {storageType === 'git' &&
        !isGitSyncEnabled &&
        (isUserOwner ? (
          <Banner
            type="info"
            title="Git Sync limited to organizations of 3 or fewer users"
            aria-label="Git Sync Feature Disabled Banner"
            className={`${isLightTheme ? 'bg-[#EEEBFF]' : 'bg-[#292535]'}`}
            message={
              <div>
                Git Sync is included on your plan for up to 3 users. Since your team is larger, you’ll need to upgrade
                your plan to use it. <LearnMoreLink href={docsPricingLearnMoreLink} />
              </div>
            }
            footer={
              <Button
                onPress={() => {
                  window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/pricing?source=app_create_git_project`);
                }}
              >
                Upgrade
              </Button>
            }
          />
        ) : (
          <Banner
            type="info"
            aria-label="Git Sync Feature Disabled Banner"
            title="Git Sync limited to organizations of 3 or fewer users"
            className={`${isLightTheme ? 'bg-[#EEEBFF]' : 'bg-[#292535]'}`}
            message={
              <div>
                Git Sync is included on your plan for up to 3 users. Because your team is larger, your admin will need
                to upgrade the plan for you to access it.
              </div>
            }
            footer={<LearnMoreLink href={docsPricingLearnMoreLink} />}
          />
        ))}
      {showStorageRestrictionMessage && (
        <Banner
          type="warning"
          aria-label="Project Storage Restriction Banner"
          message={
            <span>
              The organization owner mandates that projects must be created and stored using{' '}
              {models.project.getProjectStorageTypeLabel(storageRules)}.
            </span>
          }
        />
      )}
    </>
  );
};
