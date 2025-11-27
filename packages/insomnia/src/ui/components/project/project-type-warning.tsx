import { Banner } from '~/basic-components/banner';
import { Button } from '~/basic-components/button';
import { LearnMoreLink } from '~/basic-components/link';
import { getAppWebsiteBaseURL } from '~/common/constants';
import { docsPricingLearnMoreLink } from '~/common/documentation';
import type { StorageRules } from '~/models/organization';
import { getProjectStorageTypeLabel } from '~/models/project';
import { useIsLightTheme } from '~/ui/hooks/theme';

interface Props {
  isGitSyncEnabled: boolean;
  storageType: 'local' | 'remote' | 'git';
  storageRules: StorageRules;
  isUserOwner: boolean;
}
export const ProjectTypeWarning = ({ isGitSyncEnabled, storageType, storageRules, isUserOwner }: Props) => {
  const isLightTheme = useIsLightTheme();
  const showStorageRestrictionMessage =
    !storageRules.enableCloudSync || !storageRules.enableLocalVault || !storageRules.enableGitSync;
  return (
    <>
      {storageType === 'git' &&
        !isGitSyncEnabled &&
        (isUserOwner ? (
          <Banner
            type="info"
            title="Git Sync limited to organizations of 3 or fewer users"
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
          message={
            <span>
              The organization owner mandates that projects must be created and stored using{' '}
              {getProjectStorageTypeLabel(storageRules)}.
            </span>
          }
        />
      )}
    </>
  );
};
