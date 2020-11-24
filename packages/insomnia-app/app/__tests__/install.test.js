import { isDeprecatedDependencies } from '../plugins/install';

describe('install.js', () => {
  describe('isDeprecatedDependencies', () => {
    it('valid-warning-0', () => {
      const msg =
        'warning insomnia-plugin-xxx-yyy > xyz > xyz > xyz > xyz > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(isDeprecatedDependencies(msg)).toBe(true);
    });
    it('valid-warning-1', () => {
      const msg =
        'warning insomnia-plugin-xxx-yyy > xyz: ' +
        'xyz is no longer maintained and not recommended for usage due to the number of issues. ' +
        'Please, upgrade your dependencies to the actual version of xyz.';
      expect(isDeprecatedDependencies(msg)).toBe(true);
    });
    it('invalid-warning', () => {
      const msg =
        'warning You are using Node "6.0.0" which is not supported and may encounter bugs or unexpected behaviour.' +
        'Yarn supports the following server range: "^4.8.0 || ^5.7.0 || ^6.2.2 || >=8.0.0"';
      expect(isDeprecatedDependencies(msg)).toBe(false);
    });
    it('invalid-error', () => {
      const msg =
        'error https://npm.example.net/@types%example/-/hello-1.3.5.tgz: ' +
        'Integrity check failed for "@types/example" ' +
        "(computed integrity doesn't match our records, " +
        'got "sha512-z4kkSfaPg==")';
      expect(isDeprecatedDependencies(msg)).toBe(false);
    });
  });
});
