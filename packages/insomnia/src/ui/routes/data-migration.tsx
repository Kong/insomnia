import React, { useEffect, useState } from 'react';
import { AriaProgressBarProps, useProgressBar } from 'react-aria';

import { getAccountId, getCurrentSessionId } from '../../account/session';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';
//
const ProgressBar = (props: AriaProgressBarProps) => {
  const {
    label,
    value,
    minValue = 0,
    maxValue = 100,
  } = props;
  const {
    progressBarProps,
    labelProps,
  } = useProgressBar(props);

  // Calculate the width of the progress bar as a percentage
  const percentage = value ? (value - minValue) / (maxValue - minValue) : 0;
  const barWidth = `${Math.round(percentage * 100)}%`;

  return (
    <div {...progressBarProps} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {label &&
          (
            <span {...labelProps}>
              {label}
            </span>
          )}
        {!!label &&
          (
            <span>
              {progressBarProps['aria-valuetext']}
            </span>
          )}
      </div>
      <div style={{ height: 10, background: 'lightgray', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: barWidth, height: 10 }} className='bg-[--color-surprise]' />
      </div>
    </div>
  );
};

interface MigrationStatus {
  status: string;
  message: string;
  progress?: {
    completed: number;
    total: number;
  };
}
export const DataMigration = () => {
  const accountId = getAccountId();
  const sessionId = getCurrentSessionId();

  const [status, setStatus] = useState<MigrationStatus | null>(null);

  useEffect(() => {
    if (!accountId || !sessionId) {
      return;
    }

    // default to local
    const prefersProjectType = localStorage.getItem('prefers-project-type') ?? 'local';

    window.main.migration.start({ sessionId, prefersProjectType });
  }, [accountId, sessionId]);

  useEffect(() => {
    const unsubscribe = window.main.on('migration:status',
      (_, message: MigrationStatus) => {
        console.log(message);
        setStatus(message);
      });
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className='relative h-full w-full text-left text-base flex bg-[--color-bg]'>
      <TrailLinesContainer>
        <div
          className='flex justify-center items-center flex-col h-full w-[540px] min-h-[min(450px,90%)]'
        >
          <div
            className='flex flex-col gap-[var(--padding-sm)] items-center justify-center p-[--padding-lg] pt-12 w-full h-full bg-[--hl-xs] rounded-[var(--radius-md)] border-solid border border-[--hl-sm] relative'
          >
            <InsomniaLogo
              className='transform translate-x-[-50%] translate-y-[-50%] absolute top-0 left-1/2 w-16 h-16'
            />
            <div
              className='flex justify-center items-center flex-col h-full pt-2'
            >
              <div className='text-[--color-font] flex flex-col gap-4'>
                <h1 className='text-xl font-bold text-center'>Data Migration</h1>
                <div className='flex flex-col gap-4'>
                  <p>
                    We've detected untracked files that may need migration.
                  </p>
                  <p>
                    {status?.message}
                  </p>
                  {/* @ts-ignore */}
                  {Boolean(status?.progress) && <ProgressBar label={status?.status} value={(status?.progress?.completed / status?.progress?.total) * 100} />}
                  <ProgressBar label={status?.status} value={80} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};
