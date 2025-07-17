import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request }: ActionFunctionArgs) {
  const patch = await request.json();
  const caCertificate = await models.caCertificate.getById(patch._id);
  invariant(caCertificate, 'CA Certificate not found');
  await models.caCertificate.update(caCertificate, patch);
  return null;
}
