import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import React, { useEffect, useRef, useState } from 'react';
import { Separator } from 'react-aria-components';

import { Icon } from '../icon';

interface Props {
  icon: IconProp;
  name: string;
  isSyncing?: boolean;
  hasPendingChanges?: boolean;
  pendingChangesCount?: number;
  operationSucceed?: boolean;
  showSyncStatus?: boolean;
  pullCount?: number;
  pushCount?: number;
  isPulling?: boolean;
  isPushing?: boolean;
  temporaryGitSyncView?: boolean;
}

type PromptState = 'default' | 'loading' | 'success';

export const ProjectBranchName = ({
  icon,
  name,
  isSyncing = false,
  hasPendingChanges = false,
  pendingChangesCount = 0,
  operationSucceed = false,
  pullCount,
  pushCount,
  isPulling = false,
  isPushing = false,
  showSyncStatus = true,
  temporaryGitSyncView = false,
}: Props) => {
  const [state, setState] = useState<PromptState>('success');

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isSyncing) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setState('loading');
    } else if (state === 'loading') {
      if (operationSucceed) {
        setState('success');
        timeoutRef.current = setTimeout(() => setState('default'), 2000);
      } else {
        setState('default');
      }
    }
  }, [isSyncing, operationSucceed, state]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const iconMap: Record<PromptState, string> = {
    loading: 'spinner',
    success: 'circle-check',
    default: '',
  };

  const iconClassNameMap: Record<PromptState, string> = {
    loading: 'animate-spin',
    success: 'text-[--color-success]',
    default: '',
  };

  return (
    <div className="flex w-full items-center gap-2">
      <Icon icon={icon} className="size-4" />
      <Separator orientation="vertical" className="h-4 border border-solid border-[--hl-sm] bg-[--color-bg]" />
      <div className="relative flex items-center">
        <Icon icon="code-branch" className="size-4" />
        {pendingChangesCount > 0 && (
          <div className="absolute -bottom-2 -right-1 h-[12px] min-w-[12px] bg-[--color-surprise] px-[4px] text-center font-semibold text-[--color-font-surprise] [border-radius:20px] [font-size:6px] [line-height:12px]">
            {pendingChangesCount}
          </div>
        )}
        {hasPendingChanges && (
          <div className="absolute -bottom-1 -right-1 size-[10px] rounded-full bg-[--color-surprise]" />
        )}
      </div>
      <span className="flex-1 truncate">{name}</span>
      {showSyncStatus && (
        <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[--color-font-secondary]">
          {state !== 'default' && (
            <Icon icon={iconMap[state] as IconProp} className={`w-3 ${iconClassNameMap[state]}`} />
          )}
          <div className="flex items-center gap-0.5 overflow-hidden">
            <span>{pullCount}</span>
            <Icon icon="arrow-down" className={`w-2 ${isPulling && 'animate-down-loop'}`} />
          </div>
          <div className="flex items-center gap-0.5 overflow-hidden">
            <span>{pushCount}</span>
            <Icon icon="arrow-up" className={`w-2 ${isPushing && 'animate-up-loop'}`} />
          </div>
        </div>
      )}
      {/* This is a temporary view for Git Project Sync, it will be removed in the future */}
      {temporaryGitSyncView && (
        <div className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[--color-font-secondary]">
          {state !== 'default' && (
            <Icon icon={iconMap[state] as IconProp} className={`w-3 ${iconClassNameMap[state]}`} />
          )}
          {isPulling && (
            <div className="flex items-center gap-0.5 overflow-hidden">
              <Icon icon="arrow-down" className="animate-down-loop w-2" />
            </div>
          )}
          {isPushing && (
            <div className="flex items-center gap-0.5 overflow-hidden">
              <Icon icon="arrow-up" className="animate-up-loop w-2" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
