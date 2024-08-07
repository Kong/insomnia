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
}> = ({
  icon,
  title,
  secondaryAction,
  documentationLinks,
}) => (
  <div className="h-full overflow-hidden flex justify-center items-center pointer-events-none">
    <div className="flex flex-col items-center justify-center p-4 md:p-8 text-center opacity-80">
      <div className="text-9xl mb-4 opacity-50">{icon}</div>
      <div className="font-bold">{title}</div>
      {Boolean(secondaryAction) && (
        <>
          <div className="h-1 bg-font mt-4 mb-4 max-w-500 w-full opacity-20" />
          <div>{secondaryAction}</div>
        </>
      )}
      <div className="mt-8 mb-4 flex flex-col items-center justify-end flex-wrap">
        {documentationLinks.map(({ title, url }) => (
            <a
              key={title}
              href={url}
              className="flex mt-4 text-font font-normal pointer-events-auto"
            >
              {title}
              <SvgIcon
                icon="jump"
                className="pl-2"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
