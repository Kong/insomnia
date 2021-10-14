import { globalBeforeEach } from '../../../__jest__/before-each';
import { database as db } from '../../../common/database';
import * as models from '../../../models';

describe('database.notifyOfChange patching', () => {
  beforeEach(globalBeforeEach);

  it('will include controlled settings when a controller condition is met', async () => {
    await models.settings.getOrCreate();

    const changes: Function[] = [];
    const callback = (change: Function) => {
      changes.push(change);
    };
    db.onChange(callback);

    await models.settings.patch({
      incognitoMode: true,
      enableAnalytics: true,
      allowNotificationRequests: true,
    });

    const expectedSettings = await models.settings.getOrCreate();

    expect(changes[0]).toEqual([
      [db.CHANGE_UPDATE, expectedSettings, false],
    ]);

    db.offChange(callback);
  });
});
