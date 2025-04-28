import { describe, expect, it, vi } from 'vitest';

import { containsOnlyDeprecationWarnings } from '../main/install-plugin';

describe('install.js', () => {
  describe('containsOnlyDeprecationWarning', () => {
    it('should return true when all lines in stderr are deprecation warnings', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const stderr = // Warning #1
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.\r\n' + // Warning #2
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.\n' + // Warning #3
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(containsOnlyDeprecationWarnings(stderr)).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('should return false when stderr contains a deprecation warning and an error', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const stderr = // Warning #1
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.\r\n' + // Error #1
        'error https://npm.example.net/@types%example/-/nello-1.3.5.tgz:' +
        'Integrity check failed for "@types/example"' +
        '(computed integrity doesn\'t match our records, got "sha512-z4kkSfaPg==")\n' + // Warning #2
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(containsOnlyDeprecationWarnings(stderr)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });
});
