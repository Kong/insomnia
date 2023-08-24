import { LoaderFunction, redirect } from 'react-router-dom';

import { DEFAULT_PROJECT_ID, seed } from '../../models/project';

export const loader: LoaderFunction = async () => {
  await seed();
  return redirect(`/organization/${DEFAULT_PROJECT_ID}/project/${DEFAULT_PROJECT_ID}/workspace/wrk_scratchpad/debug`);
};
