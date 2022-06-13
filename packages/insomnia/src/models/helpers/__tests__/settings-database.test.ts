import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { database as db, offChange, onChange } from '../../../common/database';
import * as models from '../../../models';

describe('settings database', () => {
  beforeEach(globalBeforeEach);

  describe('database.notifyOfChange patching', () => {
    it('will include controlled settings when a controller condition is met', async () => {
      await models.settings.getOrCreate();

      const changes: Function[] = [];
      const callback = (change: Function) => {
        changes.push(change);
      };
      onChange(callback as any);

      await models.settings.patch({
        incognitoMode: true,
        enableAnalytics: true,
        allowNotificationRequests: true,
      });

      const expectedSettings = await models.settings.getOrCreate();

      expect(changes[0]).toEqual([
        [db.CHANGE_UPDATE, expectedSettings, false],
      ]);

      offChange(callback as any);
    });
  });

  describe('update', () => {
    it('should return the correct settings when updating a controlled setting', async () => {
      // Arrange
      const originalSettings = await models.settings.getOrCreate();

      // Act
      const updatedSettings = await models.settings.update(originalSettings, {
        incognitoMode: true,
        enableAnalytics: true,
      });

      // Assert
      const expectedSettings = await models.settings.getOrCreate();

      expect(updatedSettings).toStrictEqual(expectedSettings);
    });
  });

  describe('patch', () => {
    it('should return the correct settings when patching a controlled setting', async () => {
      // Act
      const updatedSettings = await models.settings.patch({
        incognitoMode: true,
        enableAnalytics: true,
      });

      // Assert
      const expectedSettings = await models.settings.getOrCreate();

      expect(updatedSettings).toStrictEqual(expectedSettings);
    });
  });
});
