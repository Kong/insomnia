import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';

export async function action({ request }: ActionFunctionArgs) {
  const patch = await request.json();
  const certificate = await models.clientCertificate.create(patch);
  return {
    certificate,
  };
}
