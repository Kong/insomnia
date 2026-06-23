import classNames from 'classnames';
import type { CurrentPlan } from 'insomnia-api';
import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogTrigger, Link, Popover, Separator } from 'react-aria-components';

import { Progress } from '~/basic-components/progress';
import { getAppWebsiteBaseURL } from '~/common/constants';
import { useResourceUsageFetcher } from '~/routes/resource.usage';
import { useTrialStartActionFetcher } from '~/routes/trial.start';
import { Icon } from '~/ui/components/icon';
import { TrialConfirmationModal } from '~/ui/components/modals/trial-confirmation-modal';
import { Tooltip } from '~/ui/components/tooltip';
import { usePlanData } from '~/ui/hooks/use-plan';
import { useUserService } from '~/ui/hooks/use-user-service';
import { formatNumber } from '~/ui/utils';

interface Props {
  isMinimal?: boolean;
  currentPlan?: CurrentPlan;
}

export const HeaderPlanIndicator = ({ isMinimal }: Props) => {
  const { planDisplayName } = usePlanData();
  const { isEnterpriseMember, isEssential, isEnterpriseOwner, isEnterpriseLike, trialDaysLeft, isTrailing } =
    useUserService();
  const [open, _setOpen] = useState(false);
  const [canTrial, setCanTrial] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const planName = `${planDisplayName} Plan`;

  const startFetcher = useTrialStartActionFetcher();
  const { load: usageLoad, state: usageState, data: usageData } = useResourceUsageFetcher();

  function handleStartTrial() {
    if (startFetcher.state === 'idle') {
      startFetcher.submit();
    }
    setShowTrialModal(false);
  }

  const checked = useRef(false);
  const setOpen = (value: boolean) => {
    if (!value) {
      checked.current = false;
      setShowTrialModal(false);
    }
    _setOpen(value);
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    if (usageState === 'idle' && !checked.current) {
      checked.current = true;
      usageLoad();
    }
  }, [usageLoad, usageState, open]);

  useEffect(() => {
    if (typeof usageData?.isEligible === 'boolean') {
      setCanTrial(usageData.isEligible);
    }
  }, [usageData?.isEligible]);

  useEffect(() => {
    if (startFetcher.data?.success) {
      setCanTrial(false);
    }
  }, [startFetcher.data?.success]);

  const isUnlimited = isEnterpriseLike;

  // resourceUsage
  const usedMocks = Math.min(usageData?.resourceUsage?.mocks?.calls || 0, usageData?.resourceUsage?.mocks?.quota || 0);
  const mockUsage = ((usedMocks || 0) / (usageData?.resourceUsage?.mocks?.quota || 1)) * 100;
  const mockStatus = isUnlimited ? 'success' : mockUsage >= 100 ? 'error' : 'normal';
  const mockTip =
    mockStatus === 'error'
      ? 'You have reached your monthly limit of mock server requests. Add more by Upgrading your plan.'
      : 'This number represents the amount of mock server requests are in your plan.';

  // licenseUsage
  const total = usageData?.licenseUsage?.total;
  const used = usageData?.licenseUsage?.used;
  const isUserUnlimited = total === -1;
  const free =
    usageData?.licenseUsage && 'free' in usageData.licenseUsage ? (usageData?.licenseUsage.free as number) : null;
  const seatsUsage = ((used || 0) / (total || 1)) * 100;
  const userStatus = isUserUnlimited ? 'success' : seatsUsage >= 100 ? 'error' : 'normal';
  const userTip =
    userStatus === 'error'
      ? 'You have reached your limit of licensed users. Invite more by Upgrading your plan.'
      : 'The number of users currently consuming a license within your account.';

  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <Button className="flex h-[30px] shrink-0 items-center justify-center gap-2 rounded-md px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-sm)">
        <span>{planName}</span>
        {isTrailing && (
          <span className="flex h-[20px] items-center rounded-sm bg-(--color-surprise) px-[4px] text-(--color-font-surprise)">
            Trial
          </span>
        )}
        <Icon className="w-4" icon={isMinimal ? 'caret-up' : 'caret-down'} />
      </Button>
      <Popover
        className="max-h-[85vh] min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
        placement="bottom end"
      >
        <Dialog className="focus:outline-hidden">
          <div className="mt-[8px] flex w-[250px] flex-col text-(--color-font)">
            <div className="flex items-center justify-between px-[12px]">
              <div className="flex flex-col gap-1">
                <span className="text[--color-font-surprise] flex items-center gap-[4px] font-semibold">
                  {planName}
                  {isTrailing && (
                    <span className="flex h-[20px] items-center rounded-sm bg-(--color-surprise) px-[4px] text-(--color-font-surprise)">
                      Trial
                    </span>
                  )}
                </span>
                {isTrailing && <span>{trialDaysLeft ?? '--'} days left of free trial</span>}
              </div>
              {!isEnterpriseMember && (
                <Link
                  className="rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  href={
                    isEssential
                      ? getAppWebsiteBaseURL() + '/app/pricing?source=app_topbar'
                      : getAppWebsiteBaseURL() + '/app/subscription/update?plan=enterprise&source=app_topbar'
                  }
                >
                  {isEnterpriseLike ? 'Add seats' : 'Upgrade'}
                </Link>
              )}
            </div>

            <Separator className="mt-[12px] border border-solid border-(--hl-sm)" />

            <div className="my-[8px] flex flex-col gap-[18px] px-[12px]">
              {!isEnterpriseMember && (
                <div>
                  <div className="flex items-center">
                    <span className="capitalize">{isEnterpriseLike ? 'managed ' : ''}users</span>
                    <Tooltip position="bottom" message={userTip}>
                      <Icon
                        icon={userStatus === 'error' ? 'exclamation-triangle' : 'info-circle'}
                        className={classNames('ml-2', userStatus === 'error' && 'text-(--color-danger)')}
                      />
                    </Tooltip>
                    <span className="ml-auto">
                      {used}/{isUserUnlimited ? 'Unlimited' : formatNumber(total || 0)}
                    </span>
                  </div>
                  <Progress className="mt-2" status={userStatus} percent={isUserUnlimited ? 100 : seatsUsage} />
                </div>
              )}

              {isEnterpriseOwner && (
                <div>
                  <div className="flex items-center">
                    <span className="capitalize">Unmanaged users</span>
                    <Tooltip
                      position="bottom"
                      message="The number of open source users from your verified domains, not currently attached to your account."
                    >
                      <Icon icon="info-circle" className="ml-2" />
                    </Tooltip>
                    <span className="ml-auto">{free || 0}</span>
                  </div>
                  <Progress className="mt-2" status={free ? 'success' : 'normal'} percent={free ? 100 : 0} />
                </div>
              )}

              <div>
                <div className="flex items-center">
                  <span className="capitalize">Mock Requests</span>
                  <Tooltip position="bottom" message={mockTip}>
                    <Icon
                      icon={mockStatus === 'error' ? 'exclamation-triangle' : 'info-circle'}
                      className={classNames('ml-2', mockStatus === 'error' && 'text-(--color-danger)')}
                    />
                  </Tooltip>
                  <span className="ml-auto">
                    {formatNumber(usedMocks)}/{' '}
                    {isUnlimited ? 'Unlimited' : formatNumber(usageData?.resourceUsage?.mocks?.quota || 0)}
                  </span>
                </div>
                <Progress className="mt-2" status={mockStatus} percent={isUnlimited ? 100 : mockUsage} />
              </div>
            </div>

            {!isEnterpriseMember && (
              <div className="my-[8px] px-[12px]">
                <Icon icon="gear" className="text-(--color-font)" />
                <a
                  href={getAppWebsiteBaseURL() + '/app/home'}
                  className="px-3 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  Manage
                </a>
              </div>
            )}
            {canTrial && (
              <div className="my-[8px] px-[12px]">
                <Button
                  className="h-[22px] rounded-sm bg-(--color-surprise) px-[12px] text-center text-sm text-(--color-font-surprise)"
                  onPress={() => {
                    _setOpen(false);
                    setShowTrialModal(true);
                  }}
                >
                  Free Enterprise Trial
                </Button>
              </div>
            )}
          </div>
        </Dialog>
      </Popover>
      <TrialConfirmationModal
        isOpen={showTrialModal}
        onClose={() => setShowTrialModal(false)}
        onStartTrial={handleStartTrial}
        isLoading={startFetcher.state !== 'idle'}
      />
    </DialogTrigger>
  );
};
