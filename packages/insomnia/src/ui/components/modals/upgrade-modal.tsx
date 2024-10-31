import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { useParams } from 'react-router-dom';

import { getAppWebsiteBaseURL } from '../../../common/constants';
import { isOwnerOfOrganization } from '../../../models/organization';
import { useOrganizationLoaderData } from '../../routes/organization';
import { useRootLoaderData } from '../../routes/root';
import { type ModalProps } from '../base/modal';
import { AskModal, type AskModalHandle, type AskModalOptions } from './ask-modal';

type UpgradePlanType = 'team' | 'enterprise';
export interface UpgradeModalOptions extends Partial<AskModalOptions> {
  newPlan: UpgradePlanType;
  featureName: string;
}
export interface UpgradeModalHandle {
  show: (options: UpgradeModalOptions) => void;
  hide: () => void;
}
export const UpgradeModal = forwardRef<UpgradeModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<AskModalHandle>(null);
  const { organizationId } = useParams<{ organizationId: string }>();
  const { organizations } = useOrganizationLoaderData();
  const { userSession } = useRootLoaderData();
  const currentOrg = organizations.find(organization => (organization.id === organizationId));
  const accountId = userSession.accountId;
  let isOwner = false;
  if (currentOrg && accountId) {
    isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId: userSession.accountId,
    });
  }
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
      } = options;
      const planDetail = newPlan === 'team' ? 'Team plan or above' : 'Enterprise plan';
      const upgradeDetail = isOwner ? 'please upgrade your plan.' : 'please contat the organization owner to upgrade the plan.';
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
  }), [isOwner]);

  return (
    <AskModal
      ref={modalRef}
    />
  );
});
UpgradeModal.displayName = 'UpgradeModal';
