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
  const upgradeDetail = isOwner ? 'Please upgrade your plan.' : 'Please contat the organization owner to upgrade the plan.';
  const message = `${featureName} is only enbaled for ${planDetail}.`;
  const handleUpgradePlan = () => {
    window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
  };

  return (
    <div className='mt-[--padding-lg] flex flex-col gap-3 justify-center items-center'>
      <InsomniaLogo className='h-16 w-full' />
      <Heading className="text-2xl bg-[--color-bg]">
        Upgrade Plan
      </Heading>
      <p>{message}</p>
      {isOwner ?
        (
          <Button
            aria-label="Upgrade Plan"
            className="px-4 text-[--color-font-surprise] bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] py-2 h-full font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-md hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onPress={handleUpgradePlan}
          >
            Upgrade
          </Button>
        ) :
        (
          <p>{upgradeDetail}</p>
        )
      }
    </div>
  );
};
