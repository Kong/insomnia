import React from 'react';
import { LoaderFunction } from 'react-router-dom';

import { invariant } from '../../utils/invariant';

export const loader: LoaderFunction = async ({
  request,
  params,
}): Promise<{}> => {
  const { organizationId, projectId } = params;
  invariant(organizationId, 'Organization ID is required');
  invariant(projectId, 'Project ID is required');
  return {};
};

const MockServerRoute = () => {
  return <div>Mock Server</div>;
};

export default MockServerRoute;
