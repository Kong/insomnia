import { type ActionFunctionArgs } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { testId } = params;
  const data = (await request.json()) as Partial<UnitTest>;

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  await models.unitTest.update(unitTest, data);

  return null;
}
