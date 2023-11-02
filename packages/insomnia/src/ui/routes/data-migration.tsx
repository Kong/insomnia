import React, { useEffect, useState } from 'react';
import { AriaProgressBarProps, useProgressBar } from 'react-aria';

import { getAccountId, getCurrentSessionId } from '../../account/session';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

const ProgressBar = (props: AriaProgressBarProps) => {
  const {
    value,
    minValue = 0,
    maxValue = 100,
  } = props;
  const {
    progressBarProps,
  } = useProgressBar(props);

  const percentage = value ? (value - minValue) / (maxValue - minValue) : 0;
  const barWidth = `${Math.round(percentage * 100)}%`;

  return (
    <div>
      <div {...progressBarProps} style={{ width: '100%' }}>
        <div style={{ height: 10, background: 'lightgray', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: barWidth, height: 10 }} className='bg-[--color-surprise]' />
        </div>
      </div>
      <div>{barWidth}</div>
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
interface DisplayCopy {
  title: string;
  subtitle: string;
}
export const DataMigration = () => {
  const sessionId = getCurrentSessionId();
  const accountId = getAccountId();
  const [copy, setCopy] = useState<DisplayCopy>({ title: 'Preparing', subtitle: 'Preparing for the upgrade' });
  const [update, setUpdate] = useState<MigrationStatus | null>(null);

  useEffect(() => {
    if (!sessionId || !accountId) {
      return;
    }

    // default to local
    const prefersProjectType = (localStorage.getItem('prefers-project-type') ?? 'local') as 'remote' | 'local';
    const title = prefersProjectType === 'local' ? 'Bringing your local data up to date' : 'Securely synchronizing your data';
    const subtitle = prefersProjectType === 'local' ? 'We are locally upgrading the data format for this new version of Insomnia' : 'We are enabling Cloud Sync for your account, please wait';
    setCopy({ title, subtitle });

    console.log('starting...?');
    window.main.migration.start({ sessionId, accountId, prefersProjectType });
  }, [sessionId, accountId]);

  useEffect(() => {
    const unsubscribe = window.main.on('migration:status',
      (_, message: MigrationStatus) => {
        setUpdate(message);

        if (message.status === 'complete') {
          console.log({ migrationStatus: message.status });
          // window.main.migration.stop();
          // redrirect the user to organizatino page
        }
      });
    return () => {
      unsubscribe();
    };
  }, []);

  const status = update?.status;
  const message = update?.message;
  const progress = update?.progress;
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
                <h1 className='text-xl font-bold text-center'>{copy.title}</h1>
                <div className='flex flex-col gap-4'>
                  <p>{copy.subtitle}</p>
                  <p>{message}</p>
                  {progress && <ProgressBar label={status?.toUpperCase()} value={(progress.completed / progress.total) * 100} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};
