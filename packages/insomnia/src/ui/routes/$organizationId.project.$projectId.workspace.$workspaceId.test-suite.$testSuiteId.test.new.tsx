import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ request, params }: ActionFunctionArgs) {
  const { testSuiteId } = params;
  invariant(typeof testSuiteId === 'string', 'Test Suite ID is required');
  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  await models.unitTest.create({
    parentId: testSuiteId,
    code: `const response1 = await insomnia.send();
expect(response1.status).to.equal(200);`,
    name,
  });

  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestCreate });

  return null;
}
