import { useMemo, useState } from 'react';
import { Button, GridList, GridListItem } from 'react-aria-components';
import { href, useNavigate, useParams } from 'react-router';
import * as reactUse from 'react-use';

import { scratchPadTutorialList } from '~/routes/organization.$organizationId.project.$projectId.tutorial.$panel';
import { Icon } from '~/ui/components/icon';

export const DISMISS_SNOOZE_DAYS = 14;
export const NOT_RIGHT_NOW_SNOOZE_DAYS = 120;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface SignUpTipDismissedState {
  dismissed: boolean;
  dismissedAt: number;
  // Days to hide the tip after dismissedAt; absent in older stored values (defaults to DISMISS_SNOOZE_DAYS)
  snoozeDays?: number;
}

export const shouldShowSignUpTip = (state: SignUpTipDismissedState | undefined, now: number) => {
  if (!state || !state.dismissed || !Number.isFinite(state.dismissedAt)) {
    return true;
  }

  // localStorage content is untrusted: fall back to the default for missing or invalid values
  const snoozeDays =
    Number.isFinite(state.snoozeDays) && (state.snoozeDays as number) > 0
      ? (state.snoozeDays as number)
      : DISMISS_SNOOZE_DAYS;

  return now - state.dismissedAt >= snoozeDays * MS_PER_DAY;
};

export const ScratchPadTutorialPanel = () => {
  const [signUpTipDismissedState, setSignUpTipDismissedState] = reactUse.useLocalStorage<SignUpTipDismissedState>(
    'scratchpad-sign-up-tip-dismissed',
    { dismissed: false, dismissedAt: 0 },
  );

  const [currentTime] = useState(() => Date.now());

  const snoozeSignUpTip = (snoozeDays: number) => {
    setSignUpTipDismissedState({ dismissed: true, dismissedAt: Date.now(), snoozeDays });
  };

  const handleDismiss = () => snoozeSignUpTip(DISMISS_SNOOZE_DAYS);
  const handleNotRightNow = () => snoozeSignUpTip(NOT_RIGHT_NOW_SNOOZE_DAYS);

  const {
    organizationId,
    projectId,
    panel = 'all',
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    panel?: string;
  };

  const navigate = useNavigate();
  const handleSignUp = () => {
    navigate(href('/auth/login'));
  };

  const showSignUpTip = useMemo(
    () => shouldShowSignUpTip(signUpTipDismissedState, currentTime),
    [signUpTipDismissedState, currentTime],
  );

  return (
    <>
      {showSignUpTip ? (
        <div className="m-2 rounded-lg border! border-solid border-(--hl-sm) bg-(--color-bg) p-4">
          <div className="flex flex-col items-start justify-between">
            <div className="flex w-full justify-between">
              <h3 className="mb-2 text-lg font-semibold text-(--color-font)">Unlock full features</h3>
              <Button
                onPress={handleDismiss}
                className="ml-4 flex h-6 w-6 items-center justify-center rounded-xs text-(--color-font-secondary) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font) focus:outline-hidden"
                aria-label="Dismiss tutorial"
              >
                <Icon icon="times" className="h-3 w-3" />
              </Button>
            </div>
            <p className="mb-4 text-sm text-(--color-font-secondary)">
              Create multiple API collections, MCP clients, manage projects, and collaborate with your team.
            </p>
            <div className="flex items-center gap-2">
              <Button
                onPress={handleSignUp}
                className="rounded-md bg-(--color-surprise) px-4 py-2 text-sm font-medium text-white transition-colors"
              >
                Sign up for free
              </Button>
              <Button
                onPress={handleNotRightNow}
                className="rounded-md px-4 py-2 text-sm font-medium text-(--color-font-secondary) transition-colors hover:bg-(--hl-xs) hover:text-(--color-font) focus:outline-hidden"
              >
                Not right now
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <GridList
        aria-label="Scope filter"
        items={scratchPadTutorialList}
        className="shrink-0 overflow-y-auto py-(--padding-sm) data-empty:py-0"
        disallowEmptySelection
        selectedKeys={[panel]}
        selectionMode="single"
        onSelectionChange={keys => {
          if (keys !== 'all') {
            const selected = Array.from(keys.values())[0].toString();
            navigate(`/organization/${organizationId}/project/${projectId}/tutorial/${selected}`);
          }
        }}
      >
        {item => {
          return (
            <GridListItem textValue={item.title} className="group outline-hidden select-none">
              <div className="relative flex h-12 w-full items-center gap-2 overflow-hidden px-4 text-(--hl) outline-hidden transition-colors select-none group-hover:bg-(--hl-xs) group-focus:bg-(--hl-sm) group-aria-selected:bg-(--hl-sm) group-aria-selected:text-(--color-font)">
                <span className="flex h-6 w-6 items-center justify-center">
                  <Icon icon={item.icon} className="w-6" />
                </span>

                <span className="truncate">{item.title}</span>
              </div>
            </GridListItem>
          );
        }}
      </GridList>
    </>
  );
};
