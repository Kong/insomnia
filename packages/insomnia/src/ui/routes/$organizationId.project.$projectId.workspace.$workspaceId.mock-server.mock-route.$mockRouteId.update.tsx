import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { mockRouteId } = params;
  invariant(typeof mockRouteId === 'string', 'Mock route id is required');
  const patch = await request.json();

  const mockRoute = await models.mockRoute.getById(mockRouteId);
  invariant(mockRoute, 'Mock route is required');

  await models.mockRoute.update(mockRoute, patch);
  return null;
}
