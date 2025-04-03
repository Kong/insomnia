import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { Icon } from '../icon';

interface Props {
  onCreateRequestCollectionWithRequest: () => void;
  onCreateDesignDocument: () => void;
  onImportFrom: () => void;
}

export const ProjectEmptyView: FC<Props> = ({ onCreateRequestCollectionWithRequest, onCreateDesignDocument, onImportFrom }) => {
  return (
    <div className='flex flex-col items-center pt-[15%] w-full h-full text-center gap-3'>
      <span className='font-semibold text-xl'>Welcome to your project!</span>
      <span className='text-md'>Start fresh or bring in existing work</span>
      <div className='flex flex-wrap justify-center w-full gap-[var(--padding-md)] mt-[var(--padding-lg)]'>
        <Button
          aria-label='Create request collection'
          className='w-full max-w-[180px] py-8 px-12 flex flex-col items-center justify-center border border-solid border-[--hl-sm] shadow-sm hover:bg-[--color-bg] gap-[var(--padding-xs)] sm:gap-[var(--padding-sm)] text-[var(--font-size-sm)] transition-all duration-100 rounded-md'
          onPress={onCreateRequestCollectionWithRequest}
        >
          <Icon icon="plus" className='text-xl' />
          Send a request
        </Button>
        <Button
          aria-label='Create document'
          className='w-full max-w-[180px] py-8 px-12 flex flex-col items-center justify-center border border-solid border-[--hl-sm] shadow-sm hover:bg-[--color-bg] gap-[var(--padding-xs)] sm:gap-[var(--padding-sm)] text-[var(--font-size-sm)] transition-all duration-100 rounded-md'
          onPress={onCreateDesignDocument}
        >
          <Icon icon="file" className='text-[var(--font-size-xl)]' />
          Create document
        </Button>
        <Button
          aria-label='Import'
          className='w-full max-w-[180px] py-8 px-12 flex flex-col items-center justify-center border border-solid border-[--hl-sm] shadow-sm hover:bg-[--color-bg] gap-[var(--padding-xs)] sm:gap-[var(--padding-sm)] text-[var(--font-size-sm)] transition-all duration-100 rounded-md'
          onPress={onImportFrom}
        >
          <Icon icon="file-import" className='text-[var(--font-size-xl)]' />
          Import
        </Button>
      </div>
    </div>
  );
};
