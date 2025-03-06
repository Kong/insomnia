import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { type FC } from 'react';
import { Button } from 'react-aria-components';

import { Icon } from '../icon';

interface ButtonProps {
  icon: IconName;
  label: string;
  className?: string;
  onPress: () => void;
}

const EmptyStateButton: FC<ButtonProps> = ({ icon, label, className, onPress }) => (
  <Button
    onPress={onPress}
    className={`flex items-center justify-center border border-transparent flex-col gap-[var(--padding-sm)] sm:gap-[var(--padding-md)] text-[var(--font-size-sm)] transition-all duration-300 rounded-sm ${className}`}
    style={{
      background: 'linear-gradient(120.49deg, var(--color-bg) 9.66%, var(--hl-md) 107.02%)',
    }}
  >
    <Icon icon={icon} className='text-[var(--font-size-xl)]' />
    {label}
  </Button>
);

const SquareButton: FC<ButtonProps> = props => <EmptyStateButton {...props} className='size-[120px] md:size-[150px] lg:size-[180px]' />;

const AlmostSquareButton: FC<ButtonProps> = props => <EmptyStateButton {...props} className='size-[100px] lg:size-[130px]' />;

interface Props {
  createRequestCollection: () => void;
  createDesignDocument: () => void;
  createMockServer: () => void;
  createEnvironment: () => void;
  importFrom: () => void;
}

export const EmptyStatePane: FC<Props> = ({ createRequestCollection, createDesignDocument, createMockServer, createEnvironment, importFrom }) => {
  return (
    <div className='flex flex-col flex-wrap items-center justify-center w-full h-full text-center opacity-[calc(var(--opacity-subtle)*0.8)]'>
      <span className='font-bold'>This is an empty project, to get started create your first resource:</span>
      <div className='flex flex-wrap justify-center w-full gap-[var(--padding-md)] mt-[var(--padding-md)]'>
        <SquareButton
          icon="bars"
          label="New Collection"
          onPress={createRequestCollection}
        />
        <SquareButton
          icon="file"
          label="New Document"
          onPress={createDesignDocument}
        />
        <SquareButton
          icon="server"
          label="New Mock Server"
          onPress={createMockServer}
        />
        <SquareButton
          icon="code"
          label="New Environment"
          onPress={createEnvironment}
        />
      </div>
      <hr className='py-2' />
      <div className='flex flex-wrap justify-center w-full gap-[var(--padding-md)] mt-[var(--padding-md)]'>
        <AlmostSquareButton
          icon="file-import"
          label="Import"
          onPress={importFrom}
        />
        <AlmostSquareButton
          icon="link"
          label="Url"
          onPress={importFrom}
        />
        <AlmostSquareButton
          icon="clipboard"
          label="Clipboard"
          onPress={importFrom}
        />
        <AlmostSquareButton
          icon="file"
          label="Postman"
          onPress={importFrom}
        />
      </div>
    </div>
  );
};
