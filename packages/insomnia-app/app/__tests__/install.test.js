import { containsOnlyDeprecationWarnings, isDeprecatedDependencies } from '../plugins/install';

describe('install.js', () => {
  describe('containsOnlyDeprecationWarning', () => {
    it('should return true when all lines in stderr are deprecation warnings', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const stderr =
        // Warning #1
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.\r\n' +
        // Warning #2
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.\n' +
        // Warning #3
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(containsOnlyDeprecationWarnings(stderr)).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });
    it('should return false when stderr contains a deprecation warning and an error', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const stderr =
        // Warning #1
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.\r\n' +
        // Error #1
        'error https://npm.example.net/@types%example/-/nello-1.3.5.tgz:' +
        'Integrity check failed for "@types/example"' +
        '(computed integrity doesn\'t match our records, got "sha512-z4kkSfaPg==")\n' +
        // Warning #2
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(containsOnlyDeprecationWarnings(stderr)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });
  describe('isDeprecatedDependencies', () => {
    it('should not match when the message is falsy', () => {
      expect(isDeprecatedDependencies('')).toBe(false);
      expect(isDeprecatedDependencies(null)).toBe(false);
      expect(isDeprecatedDependencies(undefined)).toBe(false);
    });
    it('should match with multiple nested dependencies', () => {
      const msg =
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(isDeprecatedDependencies(msg)).toBe(true);
    });
    it('should match with one nested dependency', () => {
      const msg =
        'warning insomnia-plugin-xxx-yyy > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(isDeprecatedDependencies(msg)).toBe(true);
    });
    it('should not match with an unrelated warning', () => {
      const msg =
        'warning You are using Node "6.0.0" which is not supported and may encounter bugs or unexpected behaviour. ' +
        'Yarn supports the following server range: "^4.8.0 || ^5.7.0 || ^6.2.2 || >=8.0.0"';
      expect(isDeprecatedDependencies(msg)).toBe(false);
    });
    it('should not match with an unrelated error', () => {
      const msg =
        'error https://npm.example.net/@types%example/-/nello-1.3.5.tgz: ' +
        'Integrity check failed for "@types/example" ' +
        '(computed integrity doesn\'t match our records, got "sha512-z4kkSfaPg==")';
      expect(isDeprecatedDependencies(msg)).toBe(false);
    });
  });
});
