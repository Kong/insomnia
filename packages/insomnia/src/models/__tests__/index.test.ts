import { describe, expect, it } from 'vitest';

import { getModel, mustGetModel } from '../index';
import * as models from '../index';

describe('index', () => {
  describe('getModel()', () => {
    it('should get model if found', () => {
      expect(getModel(models.workspace.type)).not.toBeNull();
    });

    it('should return null if model not found', () => {
      expect(getModel('UNKNOWN')).toBeNull();
    });
  });

  describe('mustGetModel()', () => {
    it('should get model if found', () => {
      expect(mustGetModel(models.workspace.type)).not.toBeNull();
    });

    it('should return null if model not found', () => {
      const func = () => mustGetModel('UNKNOWN');

      expect(func).toThrowError('The model type UNKNOWN must exist but could not be found.');
    });
  });
});
