import React, { forwardRef, useImperativeHandle, useRef } from 'react';

import { getAppWebsiteBaseURL } from '../../../common/constants';
import type { PersonalPlanType } from '../../routes/organization';
import { type ModalProps } from '../base/modal';
import { AskModal, type AskModalHandle, type AskModalOptions } from './ask-modal';

type UpgradePlanType = Exclude<PersonalPlanType, 'free' | 'individual'>;
export interface UpgradeModalOptions extends Partial<AskModalOptions> {
  newPlan: UpgradePlanType;
  featureName: string;
  isOwner: boolean;
}
export interface UpgradeModalHandle {
  show: (options: UpgradeModalOptions) => void;
  hide: () => void;
}
export const UpgradeModal = forwardRef<UpgradeModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<AskModalHandle>(null);
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: (options: UpgradeModalOptions) => {
      const {
        newPlan,
        featureName,
        title = 'Upgrade Plan',
        yesText = 'Upgrade',
        noText = 'Cancel',
        color = 'surpirse',
        isOwner,
      } = options;
      const planDetail = newPlan === 'team' ? 'Team plan or above' : 'Enterprise plan';
      const upgradeDetail = isOwner ? 'please upgrade your plan.' : 'please contact the organization owner to upgrade the plan.';
      const message = `${featureName} is only enbaled for ${planDetail}, ${upgradeDetail}`;
      const onDone = async (isYes: boolean) => {
        if (isYes) {
          window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
        }
      };
      if (isOwner) {
        modalRef.current?.show({
          title, message, yesText, noText, color,
          ...(isOwner && { onDone }),
        });
      } else {
        modalRef.current?.show({
          title, message,
        });
      }
    },
  }), []);

  return (
    <AskModal
      ref={modalRef}
    />
  );
});
UpgradeModal.displayName = 'UpgradeModal';
