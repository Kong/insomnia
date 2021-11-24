import React, { ReactNode } from 'react';

import { useRenderTemplate } from '../hooks/use-render-template';

interface RenderTemplateWrapperProps {
    children: (args: ReturnType<typeof useRenderTemplate>) => ReactNode;
  }

export const RenderTemplateWrapper = ({ children }: RenderTemplateWrapperProps) => {
  const args = useRenderTemplate();
  return <>{children(args)}</>;
};
