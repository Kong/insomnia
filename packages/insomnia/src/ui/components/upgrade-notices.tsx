import React from 'react';
import { Button, Heading } from 'react-aria-components';

import { getAppWebsiteBaseURL } from '../../common/constants';
import type { PersonalPlanType } from '../routes/organization';
import { InsomniaLogo } from './insomnia-icon';

type UpgradePlanType = Exclude<PersonalPlanType, 'free' | 'individual'>;
export interface UpgradeNoticeProps {
  newPlan: UpgradePlanType;
  featureName: string;
  isOwner: boolean;
}
export const UpgradeNotice = (props: UpgradeNoticeProps) => {
  const { newPlan, featureName, isOwner } = props;
  const planDetail = newPlan === 'team' ? 'Team plan or above' : 'Enterprise plan';
  const upgradeDetail = isOwner ? 'Please upgrade your plan.' : 'Please contact the organization owner to upgrade the plan.';
  const message = `${featureName} is only enbaled for ${planDetail}.`;
  const handleUpgradePlan = () => {
    window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
  };

  return (
    <div className='flex flex-col gap-3 justify-center items-center notice pad surprise'>
      <InsomniaLogo className='h-16 w-full' />
      <Heading className="text-2xl">
        Upgrade Plan
      </Heading>
      <p>{message}</p>
      <p>{upgradeDetail}</p>
      {isOwner &&
        <Button
          aria-label="Upgrade Plan"
          className="btn btn--clicky mt-[--padding-md]"
          onPress={handleUpgradePlan}
        >
          Upgrade <i className="fa fa-external-link" />
        </Button>
      }
    </div>
  );
};
