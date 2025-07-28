import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request }: ActionFunctionArgs) {
  const patch = await request.json();
  const clientCertificate = await models.clientCertificate.getById(patch._id);
  invariant(clientCertificate, 'CA Certificate not found');
  await models.clientCertificate.update(clientCertificate, patch);
  return null;
}
