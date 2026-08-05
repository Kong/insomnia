import classnames from 'classnames';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { getAppWebsiteBaseURL } from '~/common/constants';
import { useRootLoaderData } from '~/root';
import { useTrialCheckLoaderFetcher } from '~/routes/trial.check';
import { useTrialStartActionFetcher } from '~/routes/trial.start';
import { Icon } from '~/ui/components/icon';
import { TrialConfirmationModal } from '~/ui/components/modals/trial-confirmation-modal';
import { usePlanData } from '~/ui/hooks/use-plan';

export interface UpgradeModalOptions extends Partial<any> {
  featureName: string;
  isOwner: boolean;
}

export interface UpgradeModalHandle {
  show: (options: UpgradeModalOptions) => void;
  hide: () => void;
}

const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

export const UpgradePlanModal = () => {
  const { userSession } = useRootLoaderData()!;
  const { isFreePlan } = usePlanData();
  const { firstName, email, accountId } = userSession;
  const [open, setOpen] = useState(false);
  const [showTrialConfirmation, setShowTrialConfirmation] = useState(false);
  const { load: checkerLoad, data: checkerData } = useTrialCheckLoaderFetcher();
  const startFetcher = useTrialStartActionFetcher();

  const handleUpgrade = () => {
    window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/pricing?source=app_welcome_modal`);
  };

  const handleClose = () => {
    window.localStorage.setItem(`upgrade-modal-dismissed:${accountId}`, new Date().toISOString());
    setShowTrialConfirmation(false);
    setOpen(false);
  };

  const handleStartTrial = () => {
    if (startFetcher.state === 'idle') {
      startFetcher.submit();
    }
    setShowTrialConfirmation(false);
    setOpen(false);
  };

  // show once every 60 days, it is more safe to use useLayoutEffect in case of localStorage failure
  useLayoutEffect(() => {
    //  only show for free plan
    if (!isFreePlan) {
      return;
    }
    const dismissedDate = window.localStorage.getItem(`upgrade-modal-dismissed:${accountId}`);
    if (!dismissedDate || new Date(dismissedDate).getTime() + SIXTY_DAYS < Date.now()) {
      checkerLoad();
    }
  }, [checkerLoad, accountId, isFreePlan]);

  useEffect(() => {
    if (checkerData?.isEligible) {
      // Don't show when a deep-link import is about to open (e.g. user just
      // logged in to handle an insomnia://app/import link).
      // Check both keys to cover the full timing window: pendingDeepLinkAfterAuthorize
      // is present before the replay effect in root.tsx removes it,
      // suppressWelcomeModals is set by that same effect just before replay.
      if (
        window.sessionStorage.getItem('pendingDeepLinkAfterAuthorize') ||
        window.sessionStorage.getItem('suppressWelcomeModals')
      ) {
        window.sessionStorage.removeItem('suppressWelcomeModals');
        return;
      }
      setOpen(true);
    }
  }, [checkerData?.isEligible]);

  useEffect(() => {
    if (startFetcher.data?.success) {
      setOpen(false);
    }
  }, [startFetcher.data?.success]);

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={isOpen => {
        !isOpen && handleClose();
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && handleClose();
        }}
        className={classnames(
          'flex w-[540px] flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)',
        )}
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex shrink-0 items-center justify-between gap-2">
                <Heading slot="title" className="text-[18px] text-(--color-font)">
                  Welcome to Insomnia, {firstName || email} 🎉
                </Heading>
                <Button
                  className="ml-auto flex h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() => close()}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <div className="flex flex-col">
                <p className="text-md">
                  You’re on your way to easier and safer API testing. Before you dive in, check out how our Enterprise
                  plan can help you and your team work efficiently and at scale!
                </p>
                <p className="mt-[26px] text-[16px]">Upgrade to Enterprise now for access to...</p>
                <ul className="mt-2 flex flex-col items-start gap-2">
                  <li className="flex flex-col py-2">
                    <div className="flex items-center gap-[8px]">
                      <Icon icon="check-circle" className="h-[16px] text-(--color-surprise)" />
                      <span className="font-semibold">User Governance</span>
                    </div>
                    <span className="mt-1 ml-[24px] text-sm">
                      SSO, SCIM, RBAC and Teams let you control who can access what
                    </span>
                  </li>
                  <li className="flex flex-1 flex-col py-2">
                    <div className="flex items-center gap-[8px]">
                      <Icon icon="check-circle" className="h-[16px] text-(--color-surprise)" />
                      <span className="font-semibold">Increased Storage & Security</span>
                    </div>
                    <span className="mt-1 ml-[24px] text-sm">
                      Mandate Git, Cloud or Local project storage, plus E2EE
                    </span>
                  </li>
                  <li className="flex flex-1 flex-col py-2">
                    <div className="flex items-center gap-[8px]">
                      <Icon icon="check-circle" className="h-[16px] text-(--color-surprise)" />
                      <span className="font-semibold">World Class Support</span>
                    </div>
                    <span className="mt-1 ml-[24px] text-sm">
                      A dedicated CSM that understands you, support access, and optional pro services to start quickly
                    </span>
                  </li>
                </ul>
              </div>
              <div className="mt-3 flex justify-start gap-[20px]">
                <Button
                  className="h-[30px] rounded-sm bg-(--color-surprise) px-[12px] text-center text-sm text-(--color-font-surprise)"
                  onPress={handleUpgrade}
                >
                  Buy Now
                </Button>
                {checkerData?.isEligible && (
                  <Button
                    className="h-[30px] rounded-sm border border-solid border-(--hl-md)! px-[12px] text-sm text-(--color-font) hover:bg-(--hl-xs)"
                    onPress={() => setShowTrialConfirmation(true)}
                  >
                    Try Free for 14 Days
                  </Button>
                )}
                <Button
                  className="ml-auto h-[30px] rounded-sm border-none! px-0 text-sm text-(--color-font)"
                  onPress={() => close()}
                >
                  No, Thanks
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </Modal>
      <TrialConfirmationModal
        isOpen={showTrialConfirmation}
        onClose={() => setShowTrialConfirmation(false)}
        onStartTrial={handleStartTrial}
        isLoading={startFetcher.state !== 'idle'}
      />
    </ModalOverlay>
  );
};

UpgradePlanModal.displayName = 'UpgradePlanModal';
