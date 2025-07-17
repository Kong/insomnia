import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';

export async function action({ request }: ActionFunctionArgs) {
  const patch = await request.json();
  await models.caCertificate.create(patch);
  return null;
}
