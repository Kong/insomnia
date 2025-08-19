import type { LoaderFunctionArgs } from 'react-router';

import { gitCredentials } from '~/models';

export async function clientLoader(_args: LoaderFunctionArgs) {
  const credentials = await gitCredentials.all();

  return credentials;
}
