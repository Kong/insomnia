import React, { FC } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { RequestGroupLoaderData } from '../../routes/request-group';

export const RequestGroupPane: FC = () => {
  const { activeRequestGroup } = useRouteLoaderData('request-group/:requestGroupId') as RequestGroupLoaderData;

  return (
    <div>test{activeRequestGroup.name}</div>
  );
};
