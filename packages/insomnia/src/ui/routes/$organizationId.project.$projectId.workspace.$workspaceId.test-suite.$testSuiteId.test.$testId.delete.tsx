import { type ActionFunctionArgs } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import type { UnitTest } from '../../models/unit-test';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ params }: ActionFunctionArgs) {
  const { testId } = params;
  invariant(typeof testId === 'string', 'Test ID is required');

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });

  invariant(unitTest, 'Test not found');

  await models.unitTest.remove(unitTest);
  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestDelete });

  return null;
}
