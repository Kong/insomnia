import React, { type FC } from 'react';

export interface HeaderProps {
  headerContent: string;
}

export const Header: FC<HeaderProps> = ({
  headerContent,
}) => {
  return (
    <header>
      <h1>{headerContent}</h1>
    </header>
  );
};
