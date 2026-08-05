import React, { type FC } from 'react';

export const NoSelectedProjectView: FC = () => {
  return (
    <div className="flex h-full w-full flex-col items-center gap-3 pt-[15%] text-center">
      <span className="text-xl font-semibold">Welcome to your organization!</span>
      <span>Select a project to get started</span>
    </div>
  );
};
