/* Remove these hacks when this bug is fixed
 * https://github.com/electron-userland/electron-builder/issues/7317
 */

exports.default = async function patchSign(context) {
  if (context.electronPlatformName !== 'darwin') {
      return;
  }
  const asoSave = context.packager.adjustSignOptions;
  if (asoSave.patched) {
      return;
  }
  console.log("Applying adjustSignOptions hack");
  context.packager.adjustSignOptions = async function(signOptions, masOptions) {
      await asoSave.call(this, signOptions, masOptions);
      if (typeof signOptions.identity === 'object' && signOptions.identity.name) {
          console.warn("Applying signOptions hack for signing identity.");
          signOptions.identity = signOptions.identity.name;
      }
      if (signOptions['identity-validation'] != undefined) {
          console.warn("Applying identity validation hack.");
          signOptions.identityValidation = signOptions['identity-validation'];
          delete signOptions['identity-validation'];
      }
  };
  context.packager.adjustSignOptions.patched = true;
};
