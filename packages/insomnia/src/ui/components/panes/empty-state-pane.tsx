import React, { type FC, type ReactNode } from 'react';

import { SvgIcon } from '../svg-icon';
export const EmptyStatePane: FC<{
  icon: ReactNode;
  title: string;
  secondaryAction?: ReactNode;
  documentationLinks: {
    title: string;
    url: string;
  }[];
}> = ({ icon, title, secondaryAction, documentationLinks }) => (
  <div className="pointer-events-none flex h-full items-center justify-center overflow-hidden">
    <div className="flex flex-col items-center justify-center p-4 text-center opacity-80 md:p-8">
      <div className="mb-4 text-9xl opacity-50">{icon}</div>
      <div className="font-bold">{title}</div>
      {Boolean(secondaryAction) && (
        <>
          <div className="bg-font max-w-500 mb-4 mt-4 h-1 w-full opacity-20" />
          <div>{secondaryAction}</div>
        </>
      )}
      <div className="mb-4 mt-8 flex flex-col flex-wrap items-center justify-end">
        {documentationLinks.map(({ title, url }) => (
          <a key={title} href={url} className="text-font pointer-events-auto mt-4 flex font-normal">
            {title}
            <SvgIcon icon="jump" className="pl-2" />
          </a>
        ))}
      </div>
    </div>
  </div>
);
