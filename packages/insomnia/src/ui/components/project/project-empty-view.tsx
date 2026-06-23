import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { AnalyticsEvent } from '../../analytics';
import { Icon } from '../icon';

interface Props {
  onCreateRequestCollectionWithRequest: () => void;
  onCreateDesignDocument: () => void;
  onImportFrom: () => void;
}

export const ProjectEmptyView: FC<Props> = ({
  onCreateRequestCollectionWithRequest,
  onCreateDesignDocument,
  onImportFrom,
}) => {
  return (
    <div className="flex h-full w-full flex-col items-center gap-3 pt-[15%] text-center">
      <span className="text-xl font-semibold">Welcome to your project!</span>
      <span>Start fresh or bring in existing work</span>
      <div className="mt-(--padding-lg) flex w-full flex-wrap justify-center gap-(--padding-md)">
        <Button
          aria-label="Create request collection"
          className="flex w-full max-w-[180px] flex-col items-center justify-center gap-(--padding-xs) rounded-md border border-solid border-(--hl-sm) px-12 py-8 text-(--font-size-sm) shadow-xs transition-all duration-100 hover:bg-(--color-bg) sm:gap-(--padding-sm)"
          onPress={() => {
            window.main.trackAnalyticsEvent({
              event: AnalyticsEvent.emptyStateSendRequestClicked,
            });
            onCreateRequestCollectionWithRequest();
          }}
        >
          <Icon icon="plus" className="text-xl" />
          Send a request
        </Button>
        <Button
          aria-label="Create document"
          className="flex w-full max-w-[180px] flex-col items-center justify-center gap-(--padding-xs) rounded-md border border-solid border-(--hl-sm) px-12 py-8 text-(--font-size-sm) shadow-xs transition-all duration-100 hover:bg-(--color-bg) sm:gap-(--padding-sm)"
          onPress={() => {
            window.main.trackAnalyticsEvent({
              event: AnalyticsEvent.emptyStateCreateDocumentClicked,
            });
            onCreateDesignDocument();
          }}
        >
          <Icon icon="file" className="text-(--font-size-xl)" />
          Create document
        </Button>
        <Button
          aria-label="Import"
          className="flex w-full max-w-[180px] flex-col items-center justify-center gap-(--padding-xs) rounded-md border border-solid border-(--hl-sm) px-12 py-8 text-(--font-size-sm) shadow-xs transition-all duration-100 hover:bg-(--color-bg) sm:gap-(--padding-sm)"
          onPress={() => {
            window.main.trackAnalyticsEvent({
              event: AnalyticsEvent.importStarted,
              properties: {
                source: 'home-page',
              },
            });

            onImportFrom();
          }}
        >
          <Icon icon="file-import" className="text-(--font-size-xl)" />
          Import
        </Button>
      </div>
    </div>
  );
};
